const Process = require("./Process");

const mongo = new Process("mongosh");

const mysql = new Process("mysql");
mysql.processArguments.push("-uroot");
mysql.processArguments.push("--password=utt");

mongo.onFinish(() => {
    console.log(`[mongo]Tiempo de ejecución: ${mongo.totalTime}ms`);
});

mongo.execute();
mongo.startCount();
mongo.write("use Alumnos;")
mongo.write("\n");
mongo.write("db.Alumno.find();");
mongo.end();

mysql.onFinish(() => {
    console.log(`[mysql]Tiempo de ejecución: ${mysql.totalTime}ms`);
});

mysql.execute();
mysql.startCount();
mysql.write("use Alumnos;")
mysql.write("Select * From Alumno;");
mysql.end();