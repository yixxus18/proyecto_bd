const GeneradorReporte = require('./generador');
const Process = require('./utils/Process');
const metricas = {
    mongo: {},
    mysql: {}
};

(async () =>{
//----------------------------------Mongo----------------------------//
//mongoexport --db "Alumnos" --collection "Alumno" --out C:\tmp\export.json
const mongoexport = new Process("mongoexport");
mongoexport.ProcessArguments.push("--db");
mongoexport.ProcessArguments.push("Alumnos");
mongoexport.ProcessArguments.push("--collection");
mongoexport.ProcessArguments.push("Alumno");
mongoexport.ProcessArguments.push("--out");
mongoexport.ProcessArguments.push("export.json");
await mongoexport.ExecuteAsync(true);
console.log(`[mongoexport] Tiempo de ejecución: ${mongoexport.EndTime - mongoexport.StartTime} ms`);
metricas.mongo.exportTime = mongoexport.EndTime - mongoexport.StartTime;

/**
 * use Alumnos;
 * db.Alumno.drop();
 */
const drop = new Process("mongosh");
drop.Execute();
drop.Write("use Alumnos;");
drop.Write("\n");
drop.Write("db.Alumno.drop();");
drop.End();
await drop.Finish();
console.log(`[mongosh - drop] Tiempo de ejecución: ${drop.EndTime - drop.StartTime} ms`);
metricas.mongo.dropTime = drop.EndTime - drop.StartTime;

//mongoimport --db "Alumnos" --collection "Alumno" --file C:\tmp\export.json
const mongoimport = new Process("mongoimport");
mongoimport.ProcessArguments.push("--db");
mongoimport.ProcessArguments.push("Alumnos");
mongoimport.ProcessArguments.push("--collection");
mongoimport.ProcessArguments.push("Alumno");
mongoimport.ProcessArguments.push("--file");
mongoimport.ProcessArguments.push("export.json");
await mongoimport.ExecuteAsync(true);
console.log(`[mongoimport] Tiempo de ejecución: ${mongoimport.EndTime - mongoimport.StartTime} ms`);
metricas.mongo.importTime = mongoimport.EndTime - mongoimport.StartTime;

/**
 * use Alumnos;
 * db.Alumnos.find();
 */
const mongo = new Process("mongosh");
mongo.Execute();
mongo.Write("use Alumnos;");
mongo.Write("\n");
mongo.Write("db.Alumnos.find();");
mongo.End();
await mongo.Finish();
console.log(`[mongo - query] Tiempo de ejecución: ${mongo.EndTime - mongo.StartTime} ms`);
metricas.mongo.queryTime = mongo.EndTime - mongo.StartTime;

//----------------------------------MySQL----------------------------//
//mysqldump -uroot --password=utt Alumnos --result-file=alumnos.sql
const mysqldump = new Process("mysqldump");
mysqldump.ProcessArguments.push("-uroot");
mysqldump.ProcessArguments.push("--password=utt");
mysqldump.ProcessArguments.push("Alumnos");
mysqldump.ProcessArguments.push("--result-file=alumnos.sql");
await mysqldump.ExecuteAsync(true);
console.log(`[mysqldump] Tiempo de ejecución: ${mysqldump.EndTime - mysqldump.StartTime} ms`);
metricas.mysql.exportTime = mysqldump.EndTime - mysqldump.StartTime;

/**
 * mysql -uroot --password=utt
 * drop database Alumnos;
 * create database Alumnos;
 */
const dropDatabase = new Process("mysql");
dropDatabase.ProcessArguments.push("-uroot");
dropDatabase.ProcessArguments.push("--password=utt");
dropDatabase.Execute();
dropDatabase.Write("drop database Alumnos;");
dropDatabase.Write("create database Alumnos;");
dropDatabase.End();
await dropDatabase.Finish();
console.log(`[mysql - drop] Tiempo de ejecución: ${dropDatabase.EndTime - dropDatabase.StartTime} ms`);
metricas.mysql.dropTime = dropDatabase.EndTime - dropDatabase.StartTime;

//mysql -uroot --password=utt Alumnos < alumnos.sql
const importMySQL = new Process("mysql", {
    shell: true
});
importMySQL.ProcessArguments.push("-uroot");
importMySQL.ProcessArguments.push("--password=utt");
importMySQL.ProcessArguments.push("Alumnos");
importMySQL.ProcessArguments.push("<alumnos.sql");
await importMySQL.ExecuteAsync(true);
console.log(`[mysql - import] Tiempo de ejecución: ${importMySQL.EndTime - importMySQL.StartTime} ms`);
metricas.mysql.importTime = importMySQL.EndTime - importMySQL.StartTime;

/**
 * mysql -uroot --password=utt
 * use Alumnos;
 * SELECT * FROM Alumno;
 */
const selectMySQL = new Process("mysql");
selectMySQL.ProcessArguments.push("-uroot");
selectMySQL.ProcessArguments.push("--password=utt");
selectMySQL.Execute();
selectMySQL.Write("use Alumnos;");
selectMySQL.Write("SELECT * FROM Alumno;");
selectMySQL.End();
await selectMySQL.Finish();
console.log(`[mysql - query] Tiempo de ejecución: ${selectMySQL.EndTime - selectMySQL.StartTime} ms`);
metricas.mysql.queryTime = selectMySQL.EndTime - selectMySQL.StartTime;

console.log(metricas);

/*
const reporte = new GeneradorReporte();
const grafico = {
    type: 'bar',
    labels: "['Export', 'Drop', 'Import', 'Query']",
    title: 'Tareas de migración',
    data: `[${metricas.mongo.exportTime}, ${metricas.mongo.dropTime}, ${metricas.mongo.importTime}, ${metricas.mongo.queryTime}]` //Modificar
};
reporte.Body = 
`
<main class='container'>
    <div>
        <canvas id="grafico-mongo"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('grafico-mongo');

        new Chart(ctx, {
            type: '${grafico.type}',
            data: {
                labels: ${grafico.labels},
                datasets: [{
                    label: '${grafico.title}',
                    data: ${grafico.data}
                }]
            },
            options: {
                scales: {
                    y: {
                    beginAtZero: true
                    }
                }
            }
        });
    </script>
</main>
`
reporte.Generar();
//*/
})();