const { spawn } = require('node:child_process');
process.env.path += ";C:\\MongoDB\\bin";

let end_time, start_time, log = "";
const mongo = spawn('mongosh', [], {
    shell: true,
    detached: false
});

mongo.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    log += text;
});

mongo.stdout.on("error", (error) => {
    const text = error.toString();
    log += text;
});

mongo.on("error", (error) => {
    const text = error.toString();
    log += text;
});

//mongo.stdin.on("finish", (...))
mongo.on("close", (code) => {
    end_time = Date.now();
    console.log(log);
    console.log(`El tiempo total fue: ${end_time - start_time} ms`);
});

mongo.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    log += text;
});

mongo.stderr.on("error", (error) => {
    const text = error.toString();
    log += text;
});

start_time = Date.now();
mongo.stdin.write("use Alumnos;");
mongo.stdin.write("\n");
mongo.stdin.write("db.Alumno.find();");
mongo.stdin.end();

