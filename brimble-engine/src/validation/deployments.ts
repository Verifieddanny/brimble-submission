import { body } from "express-validator";

export const DeploymentValidation = [
    body("git_url")
        .trim()
        .notEmpty()
        .isURL()
        .withMessage('Put a valid Git URL'),
]
