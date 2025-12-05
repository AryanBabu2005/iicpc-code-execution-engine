Scalable Code Execution Engine (IICPC Track 1)

This repository is the submission for the IICPC Technical Challenge (Track 1). It is a proof-of-concept for a scalable, secure code execution engine built from scratch without using third-party APIs like Judge0 or Piston.The system is built on a decoupled Queue-Worker architecture to handle concurrent submissions and uses Docker to provide strong, OS-level sandboxing for security.

Core Architecture

The project is a "monorepo" containing two main services:

iicpc-editor/: A React + Monaco Editor frontend for users to write and submit code.

iicpc-backend/: A Node.js backend that includes:An Express API to accept submissions.

A BullMQ Job Queue (using Redis) to manage concurrent jobs.

A Worker Service that uses dockerode to run code in isolated Docker containers.

For a detailed explanation of the architectural decisions, scalability patterns, and security considerations, please see the DESIGN_DOCUMENT.md file.

How to Run This Project

You must have Node.js and Docker Desktop installed and running.

1. Prerequisites (Run Once)

Clone the Repository:
git clone [https://github.com/your-username/your-repo-name.git](https://github.com/AryanBabu2005/iicpc-code-execution-engine.git)
cd iicpc-code-execution-engine

Start the Redis Database:

This is required for the BullMQ job queue.docker run -d --name redis-queue -p 6379:6379 redis

2. Run the System (3 Terminals Required)

You will need to run three separate services in three separate terminals.

Terminal 1: Run the Backend API
cd iicpc-backend
npm install
npm run dev
This starts the API server on http://localhost:4000.

Terminal 2: Run the Backend Workercd iicpc-backend
npm install
npm run worker
This starts the worker, which will watch the queue for jobs.

Terminal 3: Run the Frontend Appcd iicpc-editor
npm install
npm run dev
This starts the React app on http://localhost:5173.

3. Access the Application

Open your browser and go to: http://localhost:5173You can now select a language, write code, and click "Run Code" to test the full system.
