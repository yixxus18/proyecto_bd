const Process = require('./Process');
const FileStream = require('fs');

let procesos = 2;
let tiempoMysql, tiempoMongo;

const mysql = new Process("mysql.exe");
mysql.ProcessArguments.push("-uroot");
mysql.ProcessArguments.push("--password=utt");
mysql.Options = {
    shell: true,
    detached: false
};

mysql.Execute();
mysql.Write("use Alumnos;");
mysql.Write("SELECT * FROM Alumno;");
mysql.End();
mysql.Finish(() => {
    procesos--;
    tiempoMysql = mysql.EndTime - mysql.StartTime;
    if(procesos === 0) {
        generarReporte();
    }
    //console.log(`[mysql] Log:`);
    //console.log(`${mysql.Logs}`);
    console.log(`[mysql] Tiempo total: ${mysql.EndTime - mysql.StartTime}`);
});

const mongo = new Process("mongosh");
mongo.Options = {
    shell: true
};

mongo.Execute();
mongo.Write("use Alumnos;");
mongo.Write("\n");
mongo.Write("db.Alumnos.find();");
mongo.End();
mongo.Finish(() => {
    procesos--;
    tiempoMongo = mongo.EndTime - mongo.StartTime;
    if(procesos === 0) {
        generarReporte();
    }
    //console.log(`[mongo] Log:`);
    //console.log(`${mongo.Logs}`);
    console.log(`[mongo] Tiempo total: ${mongo.EndTime - mongo.StartTime}`);
    generarReporte(metricas);
});

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

            new Chart(ctx, {
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

            new Chart(ctx, {
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

    FileStream.writeFileSync("reporte.html", reporte);
}