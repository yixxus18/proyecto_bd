const { spawn } = require('node:child_process');
process.env.path += ";C:\\MySQL\\bin";

let end_time, start_time, log = "";
const mysql = spawn('mysql', ["-uroot", "--password=utt"], {
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
});

mysql.on("error", (err) => {
    log += (err.toString());
});

mysql.stdin.on("finish", () => {
    end_time = Date.now();
    console.log(log);
    console.log(`El tiempo total fue: ${end_time - start_time} ms`);
});

mysql.stderr.on("data", (chunk) => {
    log += (chunk.toString());
});

mysql.stderr.on("error", (error) => {
    log += (error.toString());
});

start_time = Date.now();
mysql.stdin.write("use Alumnos;");
mysql.stdin.write("Select * From Alumno;");
mysql.stdin.end();

