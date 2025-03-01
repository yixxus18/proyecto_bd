const Process = require('./utils/Process');
const sleep = require('./utils/sleep');

const metricas = {
    mysql: {
        export: null,
        drop: null,
        import: null
    },
    mongo: {
        export: null,
        drop: null,
        import: null
    }
};

(async () => {
    const mysqldump = new Process("mysqldump");
    mysqldump.ProcessArguments.push("-uroot");
    mysqldump.ProcessArguments.push("--password=utt");
    mysqldump.ProcessArguments.push("Alumnos");
    mysqldump.ProcessArguments.push("--result-file=alumnos.sql");
    await mysqldump.ExecuteAsync(true);
    console.log(`[mysqldump] Tiempo total: ${mysqldump.EndTime - mysqldump.StartTime} ms`);
    metricas.mysql.export = mysqldump.EndTime - mysqldump.StartTime;

    const dropMysql = new Process("mysql"); 
    dropMysql.ProcessArguments.push("-uroot");
    dropMysql.ProcessArguments.push("--password=utt");
    dropMysql.Execute();
    dropMysql.Write("drop database Alumnos;");
    dropMysql.Write("create database Alumnos;");
    dropMysql.End();
    await dropMysql.Finish();
    console.log(`[dropMysql] Tiempo total: ${dropMysql.EndTime - dropMysql.StartTime} ms`);
    metricas.mysql.drop = dropMysql.EndTime - dropMysql.StartTime;


    const mysql = new Process("mysql", {
        shell: true
    });
    mysql.ProcessArguments.push("-uroot");
    mysql.ProcessArguments.push("--password=utt");
    mysql.ProcessArguments.push(" Alumnos < alumnos.sql");
    await mysql.ExecuteAsync(true);
    console.log(`[mysqlimport] Tiempo total: ${mysql.EndTime - mysql.StartTime} ms`);
    metricas.mysql.import = mysql.EndTime - mysql.StartTime;

    /*********************Mongo*************************/
    const mongoexport = new Process("mongoexport");
    mongoexport.ProcessArguments.push("--collection=Alumno");
    mongoexport.ProcessArguments.push("--db=Alumnos");
    mongoexport.ProcessArguments.push("--out=alumnos.json");
    await mongoexport.ExecuteAsync(true);
    console.log(`[mongoexport] Tiempo total: ${mongoexport.EndTime - mongoexport.StartTime} ms`);
    metricas.mongo.export = mongoexport.EndTime - mongoexport.StartTime;


    const dropMongo = new Process("mongosh"); 
    dropMongo.Execute();
    dropMongo.Write("use Alumnos;");
    dropMongo.Write("\n");
    dropMongo.Write("db.Alumno.drop();");
    dropMongo.End();
    await dropMongo.Finish();
    console.log(`[dropMongo] Tiempo total: ${dropMongo.EndTime - dropMongo.StartTime} ms`);
    metricas.mongo.drop = dropMongo.EndTime - dropMongo.StartTime;


    const mongoimport = new Process("mongoimport");
    mongoimport.ProcessArguments.push("--collection=Alumno");
    mongoimport.ProcessArguments.push("--db=Alumnos");
    mongoimport.ProcessArguments.push("alumnos.json");
    await mongoimport.ExecuteAsync(true);
    console.log(`[mongoimport] Tiempo total: ${mongoimport.EndTime - mongoimport.StartTime} ms`);
    metricas.mongo.import = mongoimport.EndTime - mongoimport.StartTime;

    //Imprimir métricas
    console.log(metricas);
    generarReporte(metricas);
})();

function generarReporte(metricas) {

    const grafico_mysql = {
        type: "bar",
        labels: `['Export', 'Drop', 'Import']`,
        data: `[${metricas.mysql.export}, ${metricas.mysql.drop}, ${metricas.mysql.import}]`,
        title: "Pruebas de rendimiento de MySQL"
    }

    const grafico_mongo = {
        type: "bar",
        labels: `['Export', 'Drop', 'Import']`,
        data: `[${metricas.mongo.export}, ${metricas.mongo.drop}, ${metricas.mongo.import}]`,
        title: "Pruebas de rendimiento de Mongo"
    }

    const reporte = 
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <title>Métricas de BDD</title>
    </head>
    <body>
        <div>
            <canvas id="grafico-mysql"></canvas>
            <hr>
            <canvas id="grafico-mongo"></canvas>

        </div>

        <script>
            const mysql = document.getElementById('grafico-mysql');
            const mongo = document.getElementById('grafico-mongo');

            new Chart(mysql, {
                type: '${grafico_mysql.type}',
                data: {
                labels: ${grafico_mysql.labels},
                datasets: [{
                    label: '${grafico_mysql.title}',
                    data: ${grafico_mysql.data},
                    borderWidth: 1
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

            new Chart(mongo, {
                type: '${grafico_mongo.type}',
                data: {
                labels: ${grafico_mongo.labels},
                datasets: [{
                    label: '${grafico_mongo.title}',
                    data: ${grafico_mongo.data},
                    borderWidth: 1
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
    </body>
    </html>
    `;

    const FileStream = require('fs');
    FileStream.writeFileSync("reporte.html", reporte);
}