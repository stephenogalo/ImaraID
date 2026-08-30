const express = require("express");
const cors = require("cors");
require("dotenv").config();
const identityRoutes = require("./routes/identity");
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/identity", identityRoutes);
app.get("/", (req, res) => {
    res.json({
        message: "AI-Blockchain Identity API is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
