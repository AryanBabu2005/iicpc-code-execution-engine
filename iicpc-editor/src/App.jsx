import { useState } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

function App() {
  // State for code, language, output, and loading status
  const [code, setCode] = useState("// Type your JavaScript code here");
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  function handleEditorChange(value, event) {
    setCode(value);
  }

  // --- This is the fully updated handleRunClick function ---
  async function handleRunClick() {
    setLoading(true);
    setOutput("Submitting code to the queue...");

    let jobId = "";

    try {
      // 1. SUBMIT THE JOB
      const response = await fetch('http://localhost:4000/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: language,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      jobId = result.jobId;
      setOutput(`Job submitted! ID: ${jobId}\nWaiting for results...`);

      // 2. START POLLING FOR RESULTS
      const intervalId = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:4000/results/${jobId}`);
          if (!res.ok) {
            // Don't throw, just log and continue polling
            console.error(`Polling error: HTTP status ${res.status}`);
            return;
          }
          
          const data = await res.json();

          if (data.status === 'completed') {
            // --- JOB SUCCESS ---
            clearInterval(intervalId); // Stop polling
            setLoading(false);
            const { stdout, stderr } = data.output;
            // Show stdout, or stderr if it exists
            setOutput(stdout || stderr); 
          
          } else if (data.status === 'failed') {
            // --- JOB FAILED ---
            clearInterval(intervalId); // Stop polling
            setLoading(false);
            setOutput(`Error: ${data.error}`);
          
          } else {
            // --- JOB PENDING ---
            // Keep polling, do nothing
            console.log("Job is still pending...");
          }

        } catch (pollError) {
          console.error("Error polling results:", pollError);
          clearInterval(intervalId); // Stop polling on critical error
          setLoading(false);
          setOutput(`Error fetching results: ${pollError.message}`);
        }
      }, 1500); // Check every 1.5 seconds

    } catch (submitError) {
      console.error("Error submitting code:", submitError);
      setOutput(`Error: ${submitError.message}`);
      setLoading(false);
    }
  }
  // --- End of updated handleRunClick ---

  return (
    <div className="App">
      <header className="App-header">
        <h3>IICPC Code Editor</h3>
      </header>

      <div className="controls">
        <label>Language: </label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          {/* We can add more languages later */}
        </select>
      </div>

      <div className="editor-container">
        <Editor
          height="60vh"
          language={language}
          value={code} // Use 'value' to control the component
          onChange={handleEditorChange}
          theme="vs-dark"
        />
      </div>

      <div className="button-container">
        <button onClick={handleRunClick} className="run-button" disabled={loading}>
          {loading ? 'Submitting...' : 'Run Code'}
        </button>
      </div>

      <div className="output-container">
        <h4>Output:</h4>
        <pre>{output}</pre>
      </div>
    </div>
  );
}

export default App;