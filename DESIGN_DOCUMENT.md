Design Document: Scalable Code Execution Engine

1. Overview
This document outlines the architecture of a scalable, secure, and robust engine for executing arbitrary user-submitted code. The primary goal was to solve the core technical challenges of scalability and security without relying on third-party execution APIs like Judge0, as specified in the challenge.

The solution is a distributed system built on a Queue-Worker architecture. This design decouples the user-facing API from the resource-intensive execution, allowing the system to handle a high volume of concurrent submissions gracefully. Security and resource management are enforced using Docker containers configured with strict, low-level sandboxing.

2. System Architecture
The system is composed of four distinct, decoupled services:

Frontend (React Client): A web interface using @monaco-editor/react for code input. It submits code to the API and polls for results.

Backend API (Node.js / Express): A lightweight HTTP server that serves as the "front door." Its only job is to validate requests and add them to a job queue.

Message Queue (Redis / BullMQ): The central "buffer" that holds all pending code execution jobs. This component ensures scalability and resilience.

Execution Worker (Node.js / Dockerode): A separate service (or cluster of services) that pulls jobs from the queue, executes them in a secure container, and saves the result.

Architectural Diagram

[User] --> [1. React Frontend] --> [2. Backend API] --> [3. Message Queue] --> [4. Execution Worker]
   |            (Submit Job)          (Add Job)             (Job ID)             (Process Job)
   |                                                                                |
   |                                                                                |
   (Poll for Result) <------------------------------------ (Saves Result) <----------

3. Core Components & Technical Decisions

3.1. Frontend (React + Monaco)
Technology: React (Vite) and @monaco-editor/react.

Rationale: Provides a modern, responsive user interface. Using Monaco directly, as specified, provides a rich, VS Code-like editing experience.

Flow: The frontend uses an asynchronous fetch call to submit the code. Upon receiving a jobId, it begins polling a /results/:jobId endpoint every 1.5 seconds to check for job completion.

3.2. Backend API (Node.js + Express)
Technology: Node.js, Express.

Rationale: Node.js is ideal for this I/O-bound task. The API is kept extremely lightweight. Its sole responsibility is to validate the request, create a job with the code and language, and add it to the BullMQ queue.

Key Decision: The API does not execute code directly. This is critical for scalability. A direct exec() call would block the server, crash it on an error, and be a massive security risk.

3.3. Message Queue (Redis + BullMQ)
Technology: BullMQ (backed by Redis).

Rationale (Scalability): This is the core of the system's scalability.

Decoupling: The API and Workers operate independently. If 10,000 users submit code at once, the API simply adds 10,000 jobs to the queue instantly and remains responsive.

Concurrency: We can run multiple worker.js instances (e.g., 5, 10, or 100) that all pull from the same queue, allowing for true parallel processing of submissions.

Resilience: If a worker crashes while processing a job, BullMQ's stall detection ensures the job is requeued and picked up by another worker.

3.4. Execution Worker (Node.js + Dockerode)
Technology: Node.js, dockerode (Docker SDK).

Rationale (Security & Sandboxing): This is the solution to the "secure execution" problem. Instead of building a complex sandbox from scratch, we leverage the OS-level primitives provided by Docker.

Implementation: When a worker receives a job:

It pulls the appropriate official Docker image (e.g., node:alpine, python:alpine).

It creates a new container with the user's code mounted as a read-only file.

This container is heavily sandboxed using HostConfig:

Network Disabled (NetworkMode: 'none'): Prevents all network access (e.g., fetch calls, pip install, crypto-mining).

Memory & CPU Limits (Memory: 256m, CpuQuota): Prevents denial-of-service attacks by limiting resource usage (leveraging kernel-level cgroups).

Filesystem Isolation (ReadonlyRootfs: true): The container's filesystem is read-only. The user's code can only write to its own stdout/stderr.

Process Isolation: The container runs in its own process namespace, unable to see or interact with other processes on the host machine.

A 5-second timeout is enforced on the container to kill infinite loops.

The worker captures the stdout and stderr streams, and the job is marked as "completed" or "failed."

4. Alternatives Considered
Client-Side Execution (Web Workers):

Pro: Very secure (sandboxed by the browser).

Con: Not a viable solution. It only supports JavaScript. It cannot run Python, C++, Java, or other languages required by a judging platform.

Direct Server exec() Call:

Pro: Simple to implement.

Con: Unacceptable. This is a massive security and stability flaw. A user could run rm -rf /, access environment variables, or scan the local network. It also doesn't scale, as it would block the main server thread.

Third-Party APIs (Judge0, Piston):

Pro: Solves the problem easily.

Con: Explicitly forbidden by the challenge constraints.

5. Conclusion
This architecture directly addresses the core challenges of scalability and security. By using a battle-tested Queue-Worker model, the system can scale to handle any number of concurrent submissions by simply adding more stateless workers. By using Docker as a sandbox, we leverage powerful, kernel-level OS features to safely execute untrusted code with strict resource limits, which is a far more robust and secure solution than any custom-built sandbox.