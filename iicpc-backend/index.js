const express = require('express');
const { Queue } = require('bullmq');
const cors = require('cors');

const app = express();
const PORT = 4000; // Our backend will run on port 4000

// --- App Configuration ---
// Allow our React app (on port 5173) to talk to this backend
app.use(cors({ origin: 'http://localhost:5173' })); 
// Parse incoming JSON request bodies
app.use(express.json());

// --- Queue Setup ---
// Initialize our code queue, connecting to the Redis server
const codeQueue = new Queue('code-jobs', {
  connection: {
    host: 'localhost',
    port: 6379
  }
});
console.log("Queue 'code-jobs' initialized.");

// --- API Endpoint: Submit Job ---
// This is the endpoint our React app will call
app.post('/submit', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required.' });
    }

    // 1. Add the job to the queue
    const job = await codeQueue.add('run-code', { 
      code, 
      language 
    });

    console.log(`[Job Added] ID: ${job.id} Language: ${language}`);

    // 2. Respond to the frontend
    res.json({
      message: 'Job submitted successfully!',
      jobId: job.id
    });

  } catch (error) {
    console.error("Error submitting job:", error);
    res.status(500).json({ error: 'Failed to submit job.' });
  }
});

// --- API Endpoint: Check Job Status ---
// This is the new endpoint the frontend will poll
app.get('/results/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  // 1. Find the job in the queue
  const job = await codeQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ status: 'error', error: 'Job not found' });
  }

  // 2. Get its current state
  const state = await job.getState();
  
  // 3. Respond based on the state
  if (state === 'completed') {
    // job.returnvalue holds what our worker returned
    res.json({ status: 'completed', output: job.returnvalue });
  } else if (state === 'failed') {
    // job.failedReason holds the error message
    res.json({ status: 'failed', error: job.failedReason });
  } else {
    // It's 'active' (running) or 'waiting' (in queue)
    res.json({ status: 'pending' });
  }
});


// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});