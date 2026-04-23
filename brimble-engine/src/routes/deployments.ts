import { Router } from "express";
import { DeploymentValidation } from "../validation/deployments";
import { deleteDeployment, deployProject, getAllDeployments, getDeployment, streamLogs } from "../controller/deployments";

const DeploymentsRouter = Router();

DeploymentsRouter.post("/", DeploymentValidation, deployProject)
DeploymentsRouter.get("/", getAllDeployments)

DeploymentsRouter.get("/:id", getDeployment)
DeploymentsRouter.delete("/:id", deleteDeployment)

DeploymentsRouter.get("/:id/logs", streamLogs)


export default DeploymentsRouter;