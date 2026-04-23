import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import type { CaddyRoute, CustomError } from "../shared/types";
import { db } from "../db";
import { Deployment } from "../db/schema";
import { logEmitter, startDeployment } from "../service/deployment.service";
import { desc, eq } from "drizzle-orm";
import { spawnSync } from "child_process";

export const deployProject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: CustomError = new Error("Invalid inputs");
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }

    const githubUrl = req.body.git_url;


    const [newProject] = await db
      .insert(Deployment)
      .values({
        gitUrl: githubUrl,
        status: "pending",
        logs: "",
        port: 0,
      })
      .returning();

    if (!newProject) {
      const error: CustomError = new Error("Failed to deploy project");
      error.statusCode = 500;
      throw error;
    }



    res.status(201).json({
      project: newProject
    });

    await startDeployment(newProject.id, githubUrl);




  } catch (err) {
    const error = err as CustomError;

    if (!error.statusCode) {
      error.statusCode = 500;
    }

    next(error);
  }
};

export const getAllDeployments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deployments = await db
      .select()
      .from(Deployment)
      .orderBy(desc(Deployment.createdAt));

    res.status(200).json(deployments);
  } catch (err) {
    next(err);
  }
};

export const getDeployment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deployId = req.params.id as string;
    const [deployment] = await db
      .select()
      .from(Deployment)
      .where(eq(Deployment.id, deployId));

    if (!deployment) {
      const error: CustomError = new Error("Deployment not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json(deployment);
  } catch (err) {
    next(err);
  }
};

export const deleteDeployment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deployId = req.params.id as string;
    const domain = `${deployId}.localhost`;

    const [deployment] = await db.select().from(Deployment).where(eq(Deployment.id, deployId));

    if (!deployment) {
      const error: CustomError = new Error("Deployment not found");
      error.statusCode = 404;
      throw error;
    }

    if (deployment.imageTag) {
      console.log(`Stopping container: ${deployment.imageTag}`);
      spawnSync("docker", ["rm", "-f", deployment.imageTag]);
      spawnSync("docker", ["rmi", deployment.imageTag]); 
    }

   try {
      const caddyConfigResponse = await fetch(`${process.env.CADDY_ENDPOINT!}`);
      
      if (caddyConfigResponse.ok) {
        const routes = await caddyConfigResponse.json() as CaddyRoute[];
        
        const routeIndex = routes.findIndex((route) => 
          route.match?.[0]?.host?.includes(domain)
        );

        if (routeIndex !== -1) {
          await fetch(`${process.env.CADDY_ENDPOINT!}/${routeIndex}`, {
            method: "DELETE"
          });
        }
      }
    } catch (caddyError) {
      console.error("Caddy Cleanup Error:", caddyError);
    }
    await db.delete(Deployment).where(eq(Deployment.id, deployId));

    res.status(200).json({ message: "Deployment deleted and container stopped" });
  } catch (err) {
    next(err);
  }
};

export const streamLogs = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const deployment = await db.query.Deployment.findFirst({
        where: eq(Deployment.id, id)
    });
    if (deployment?.logs) {
        res.write(`data: ${JSON.stringify({ line: deployment.logs })}\n\n`);
    }

    const listener = (line: string) => {
        res.write(`data: ${JSON.stringify({ line })}\n\n`);
    };
    logEmitter.on(id, listener);

    req.on('close', () => {
        logEmitter.off(id, listener);
    });
};