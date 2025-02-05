const { spawn } = require('node:child_process');

class Process {
    /**
     * 
     * @param {String} executable 
     */
    constructor(executable) {
        process.env.path += ";C:\\MongoDB\\bin";
        process.env.path += ";C:\\MySQL\\bin";
        this.process = null;
        this.executable = executable;
        this.process_arguments = [];
        this.errors = "";
        this.logs = "";
        this.stdout = "";
        this.start_time;
        this.end_time;

        this.finish = (cb) => {
            cb();
        }
    }

    write(cmd) {
        this.process.stdin.write(cmd);
    }

    end() {
        this.process.stdin.end();
    }

    onFinish(cb) {
        this.callback = cb;
    }

    startCount() {
        this.start_time = Date.now();
    }

    execute() {
        this.process = spawn(this.executable, this.process_arguments, {
            shell: true,
            detached: false
        });

        this.process.stdout.on("data", (chunk) => {
            const text = chunk.toString();
            this.logs += text;
            this.stdout += text;
        });
        
        this.process.stdout.on("error", (error) => {
            const text = error.toString();
            this.errors += text;
            this.stdout += text;
        });
        
        this.process.on("error", (error) => {
            const text = error.toString();
            this.errors += text;
            this.stdout += text;
        });
        
        //this.process.stdin.on("finish", (...))
        this.process.on("close", (code) => {
            this.end_time = Date.now();
            this.finish(this.callback);
        });
        
        this.process.stderr.on("data", (chunk) => {
            const text = chunk.toString();
            this.errors += text;
            this.stdout += text;
        });
        
        this.process.stderr.on("error", (error) => {
            const text = error.toString();
            this.errors += text;
            this.stdout += text;
        });
    }

    get processArguments() {
        return this.process_arguments;
    }

    set processArguments(value) {
        this.process_arguments = value;
    }

    get Logs() {
        return this.logs;
    }

    get Errors() {
        return this.errors;
    }

    get Stdout() {
        return this.stdout;
    }

    get totalTime() {
        return this.end_time - this.start_time;
    }
}

module.exports = Process;