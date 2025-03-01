const { spawn } = require('node:child_process');
process.env.path += ";C:\\MongoDB\\bin";

let end_time, start_time, log = "";
const mysql = spawn('mongosh', [], {
    shell: true,
    detached: false
});

mysql.stdout.on("data", (chunk) => {
    log += (chunk.toString());
});

mysql.stdout.on("error", (err) => {
    log += (err.toString());
});

mysql.stdout.on("close", (code) => {
    log += (code);
    console.log(log);
    console.log(`El tiempo total fue: ${end_time - start_time} ms`);
});

mysql.on("error", (err) => {
    log += (err.toString());
});

mysql.stdin.on("finish", () => {
    end_time = Date.now();
});

mysql.stderr.on("data", (chunk) => {
    log += (chunk.toString());
});

mysql.stderr.on("error", (error) => {
    log += (error.toString());
});

start_time = Date.now();
mysql.stdin.write("use Alumnos;");
mysql.stdin.write("\n");
mysql.stdin.write("db.Alumno.find()");
mysql.stdin.end();