const { spawn } = require("child_process");
const path = require("path");

const analyzeActivity = (activity) => {
    return new Promise((resolve, reject) => {

        const pythonPath = path.join(
            __dirname,
            "../ai-env/bin/python3"
        );

        const pythonScript = path.join(
            __dirname,
            "../ai/aiService.py"
        );

        const pythonProcess = spawn(
            pythonPath,
            [pythonScript]
        );

        let output = "";
        let errorOutput = "";

        pythonProcess.stdin.write(
            JSON.stringify(activity)
        );

        pythonProcess.stdin.end();

        pythonProcess.stdout.on("data", (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on("data", (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on("close", (code) => {

            if (code !== 0) {
                return reject(
                    new Error(
                        errorOutput ||
                        `AI process exited with code ${code}`
                    )
                );
            }

            try {

                const result = JSON.parse(
                    output.trim()
                );

                if (result.error) {
                    return reject(
                        new Error(result.error)
                    );
                }

                resolve(result);

            } catch (error) {

                reject(
                    new Error(
                        `Invalid AI response: ${output}`
                    )
                );
            }
        });

        pythonProcess.on("error", (error) => {
            reject(error);
        });
    });
};

module.exports = {
    analyzeActivity
};
