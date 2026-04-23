import express, { type NextFunction, type Request, type Response } from "express";
import cors from 'cors';
import { migrateDb } from "./db";
import DeploymentsRouter from "./routes/deployments";
import type { CustomError } from "./shared/types";

const app = express();
const PORT = process.env.PORT || 8080;


app.use(cors());
app.use(express.json());

app.use(
    (error: CustomError, _req: Request, res: Response, _next: NextFunction) => {
        const statusCode = error.statusCode || 500;
        const message = error.message;
        const data = error.data;

        res.status(statusCode).json({ message, data });
    },
);

app.use("/api/deployments", DeploymentsRouter)

const startServer = async () => {
    try {
        migrateDb();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();