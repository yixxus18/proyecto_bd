const GeneradorReporte = require('./generador');
const Process = require('./utils/Process');

let terminados = 2;
let tiempoMySQL;
let tiempoMongo;

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
    tiempoMySQL = mysql.EndTime - mysql.StartTime;
    terminados--;
    if(terminados == 0) {
        generarReporte();
    }
    console.log(`[mysql] Log:`);
    console.log(`${mysql.Logs}`);
    console.log(`[mysql] Tiempo total: ${mysql.EndTime - mysql.StartTime}`);
});

const mongo = new Process("mongosh");
mongo.Options = {
    shell: true,
    detached: false
};

mongo.Execute();
mongo.Write("use Alumnos;");
mongo.Write("\n");
mongo.Write("db.Alumnos.find();");
mongo.End();
mongo.Finish(() => {
    tiempoMongo = mongo.EndTime - mongo.StartTime;
    terminados--;
    if(terminados == 0) {
        generarReporte();
    }
    console.log(`[mongo] Log:`);
    console.log(`${mongo.Logs}`);
    console.log(`[mongo] Tiempo total: ${mongo.EndTime - mongo.StartTime}`);
});

function generarReporte() {
    const reporte = new GeneradorReporte();
    const grafico = {
        type: 'doughnut',
        labels: "['MySQL', 'Mongo']",
        title: 'Tiempo de ejecución de query',
        data: `[${tiempoMySQL}, ${tiempoMongo}]` //Modificar
    };
    reporte.Body = 
`
<main class='container'>
    <div>
        <canvas id="grafico"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('grafico');

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
}