const { Worker } = require('bullmq');
const Docker = require('dockerode');
const fs = require('fs/promises'); // For writing code to temp files
const path = require('path');

const docker = new Docker();

// --- Main Worker Logic ---
const worker = new Worker('code-jobs', async (job) => {
  const { language, code } = job.data;
  const jobId = job.id;
  console.log(`[Job Received] ID: ${jobId}, Language: ${language}`);

  // Create a unique temporary directory for this job
  const tempDir = path.join(__dirname, 'temp', jobId.toString());
  
  try {
    // 1. Create the temp directory
    await fs.mkdir(tempDir, { recursive: true });

    // 2. Run the code in a secure Docker container
    const result = await runCodeInDocker(language, code, tempDir);
    
    console.log(`[Job Success] ID: ${jobId}, Output: ${result.stdout || result.stderr}`);
    
    // 3. Clean up the temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return result; // Return result to BullMQ

  } catch (error) {
    console.error(`[Job Failed] ID: ${jobId}, Error: ${error.message}`);
    
    // 4. Ensure cleanup on failure
    await fs.rm(tempDir, { recursive: true, force: true });

    throw error; // Throw error to BullMQ
  }
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5 
});

console.log("Worker service started. Waiting for jobs...");

// --- Docker Execution Function ---
async function runCodeInDocker(language, code, tempDir) {
  let imageName = '';
  let command = [];
  let codeFileName = '';

  // 1. Prepare based on language
  if (language === 'javascript') {
    imageName = 'node:alpine';
    codeFileName = 'index.js';
    command = ['node', codeFileName];
  } else if (language === 'python') {
    imageName = 'python:alpine';
    codeFileName = 'main.py';
    command = ['python', codeFileName];
  } else {
    throw new Error(`Unsupported language: ${language}`);
  }

  // 2. Write the code to the temp file
  const codeFilePath = path.join(tempDir, codeFileName);
  await fs.writeFile(codeFilePath, code);
  
  // 3. Define the container options (THE SANDBOX)
  const containerOptions = {
    Image: imageName,
    Cmd: command,
    HostConfig: {
      Binds: [`${tempDir}:/app:ro`], // Mount code as read-only
      Memory: 256 * 1024 * 1024,   // 256MB RAM limit
      CpuPeriod: 100000,
      CpuQuota: 50000,            // 50% of one CPU core
      NetworkMode: 'none',        // Disable networking
      ReadonlyRootfs: true,       // Make container FS read-only
    },
    WorkingDir: '/app',
    // Stop the container after 5 seconds
    StopTimeout: 5, 
  };

  try {
    // 4. Pull the image if it doesn't exist
    await pullImage(imageName);

    // 5. Create and start the container
    const container = await docker.createContainer(containerOptions);
    await container.start();

    // 6. Wait for the container to finish, or timeout
    const waitData = await container.wait({ timeout: 5000 }); // 5 sec timeout

    // 7. Get the logs
    const logStream = await container.logs({ stdout: true, stderr: true });
    
    // This is a more robust way to capture streams
    let stdout = '';
    let stderr = '';
    
    logStream.on('data', (chunk) => {
        // Docker multiplexes stdout and stderr. 
        // A simple way to capture (a more complex parser is needed for real-time)
        stdout += chunk.toString('utf8');
    });

    await new Promise(resolve => logStream.on('end', resolve));

    // 8. Clean up: Remove the container
    await container.remove();
    
    // This is a simplification. A production system would parse the
    // multiplexed stream. For this challenge, this is fine.
    if (waitData.StatusCode !== 0) {
        stderr = stdout; // If it errored, output is error
        stdout = '';
    }

    return { stdout, stderr };

  } catch (error) {
    // If we're here, the container likely timed out or failed to start
    console.error("Docker execution error:", error);
    throw new Error(`Container execution failed: ${error.message}`);
  }
}

// Helper function to pull Docker images
async function pullImage(imageName) {
  // Check if image exists locally first
  try {
    const image = docker.getImage(imageName);
    await image.inspect();
    // console.log(`Image ${imageName} already exists locally.`);
    return;
  } catch (e) {
    // Image not found, pull it
    console.log(`Pulling image: ${imageName}...`);
    return new Promise((resolve, reject) => {
      docker.pull(imageName, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err, output) => {
          if (err) return reject(err);
          console.log(`Image ${imageName} pulled successfully.`);
          resolve(output);
        });
      });
    });
  }
}