const GeneradorReporte = require('./generador');
const Process = require('./utils/Process');
const metricas = {
    mongo: {},
    mysql: {}
};

(async () =>{
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
drop.Finish(async () => {
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

    const mongo = new Process("mongosh");
    mongo.Execute();
    mongo.Write("use Alumnos;");
    mongo.Write("\n");
    mongo.Write("db.Alumnos.find();");
    mongo.End();
    mongo.Finish(() => {
        console.log(`[query] Tiempo de ejecución: ${mongo.EndTime - mongo.StartTime} ms`);
    metricas.mongo.queryTime = mongo.EndTime - mongo.StartTime;
    
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

    });
});
})();