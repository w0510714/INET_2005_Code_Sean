const express = require('express');
const mysql = require('mysql2');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'lamp_db',
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'userpassword',
  database: process.env.DB_NAME || 'school_db',
  port: process.env.DB_PORT || 13306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Serve HTML page
app.get('/', (req, res) => {
  const sql = `SELECT FirstName, LastName, Department, Salary, HireDate FROM Employees`; // Adjusted to match new data

  // Executing the query
  pool.query(sql, (err, results) => {
    if (err) {
        console.error('❌ Query error:', err);
        return res.status(500).send(`<h3>Database query failed: ${err.message}</h3>`);
    }

    // Creating the HTML table
    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Employees List</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65" crossorigin="anonymous">
    </head>
    <body class="container">
      <h2 class="mb-4">Employees List</h2>
      <table class="table table-striped table-bordered">
        <thead class="bg-success text-white"> // Changed to a green header
          <tr>
            // Adjusted table headers to match new data
            <th>First Name</th>
            <th>Last Name</th>
            <th>Department</th>
            <th>Salary</th>
            <th>Hire Date</th>
          </tr>
        </thead>
        <tbody>`;

    if (results.length > 0) {
      results.forEach(row => {
        html += `
          <tr>
            // Adjusted to match new data
            <td>${row.FirstName}</td>
            <td>${row.LastName}</td>
            <td>${row.Department}</td>
            <td>${row.Salary}</td>
            <td>${row.HireDate}</td>
          </tr>`;
      });
    } else {
      html += `<tr><td colspan="7" class="text-center">No employees found.</td></tr>`;
    }

    html += `
        </tbody>
      </table>
    </body>
    </html>`;

    res.send(html);
  });
});

// Start the server and listing the specific port to go to
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});