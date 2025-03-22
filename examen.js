const Process = require("./utils/Process");
const GeneradorReporte = require("./generador");

function random_number(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function random_text(characters_num) {
    let text = "";
    for(let i = 0; i < characters_num; i++) {
        const letra = String.fromCharCode(random_number(65, 90));
        text += letra;
    }
    return text;
}

function generate_data(size) {
    let csv = "";
    for (let i = 0; i < size; i++) {
        const nombre = random_text(random_number(5, 20));
        const grupo = random_number(5,20);
        const apellido = random_text(random_number(5,20));
        const calificaciones = random_number(1,20);
        csv += `${nombre},${grupo},${apellido},${calificaciones}\r\n`;
    }
    return csv;
}

function generate_ex(size) {
    let csv = "";
    for (let i = 0; i < size; i++) {
        const x = random_text(random_number(5, 20));
        const y = random_number(5,20);
        const z = random_number(5,20);
        csv += `${x},${y},${z}\r\n`;
    }
    return csv;
}

async function executeMySQLCommand(command) {
    const process = new Process("mysql"); 
    process.ProcessArguments.push("-uroot");
    process.ProcessArguments.push("--password=utt");
    process.ProcessArguments.push("--local-infile=1"); 
    process.ProcessArguments.push("--enable-local-infile");
    process.Execute();
    process.Write(command);
    process.End();
    await process.Finish();
    return process.EndTime - process.StartTime;
}

(async () => {
    const NUM = 8000;
    const NUM2 = 4000;
    const NUM3 = 100000
    const metricas = {
        generarcalifiaciones: 0,
        insertcalificaciones: 0,
        dump: 0,
        generarexalumnos: 0,
        insertexalumnos: 0,
        generatecsvexalumnos: 0, 
        exportcsvexalumnos: 0, 
        promedioz:0,
    };

    const exportStart = Date.now();
    require('fs').writeFileSync("C:/tmp/datos_generados.csv", generate_data(NUM));
    metricas.generarcalifiaciones = Date.now() - exportStart;

    const insertCalifs = `
        USE alumnos;
        LOAD DATA LOCAL INFILE 'C:/tmp/datos_generados.csv'
        INTO TABLE alumnos.Calificaciones
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n'
    `;
    metricas.insertcalificaciones = await executeMySQLCommand(insertCalifs);

    const dumpProcess = new Process("mysqldump");
    dumpProcess.ProcessArguments.push("-uroot");
    dumpProcess.ProcessArguments.push("--password=utt");
    dumpProcess.ProcessArguments.push("alumnos");
    dumpProcess.ProcessArguments.push("--result-file=C:/tmp/dump.sql");
    await dumpProcess.ExecuteAsync(true);
    metricas.dump = dumpProcess.EndTime - dumpProcess.StartTime;

    const exportStarts = Date.now();
    require('fs').writeFileSync("C:/tmp/exalumnos_generados.csv", generate_ex(NUM2));
    metricas.generarexalumnos = Date.now() - exportStarts;

    const insertcomands = `
        USE alumnos;
        LOAD DATA LOCAL INFILE 'C:/tmp/exalumnos_generados.csv'
        INTO TABLE alumnos.exalumnos
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n'
    `;
    metricas.insertexalumnos = await executeMySQLCommand(insertcomands);

    const generateex = Date.now();
    require('fs').writeFileSync("C:/tmp/exalumnos_generados2.csv", generate_ex(NUM3));
    metricas.generatecsvexalumnos = Date.now() - generateex;

    const importCommands = `
        USE alumnos;
        LOAD DATA LOCAL INFILE 'C:/tmp/exalumnos_generados2.csv'
        INTO TABLE alumnos.exalumnos
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n'
    `;
    metricas.exportcsvexalumnos = await executeMySQLCommand(importCommands);

    const avgCommand = `
        USE alumnos;
        SELECT AVG(z) FROM exalumnos;
    `;
    metricas.promedioz = await executeMySQLCommand(avgCommand);

    const reporte = new GeneradorReporte();
    const grafico = {
        type: 'bar',
        labels: "['generarcalificaciones', 'insertcalificaciones', 'dump', 'generarexalumnos', 'insertexalumnos', 'generatecsvexalumnos', 'exportcsvexalumnos', 'promedioz']",
        title: 'Tareas de practica MySQL',
        data: `[ ${metricas.generarcalifiaciones}, ${metricas.insertcalificaciones}, ${metricas.dump}, ${metricas.generarexalumnos}, ${metricas.insertexalumnos}, ${metricas.generatecsvexalumnos}, ${metricas.exportcsvexalumnos}, ${metricas.promedioz}]`
    };

    reporte.Body = `
    <main class='container mt-5'>
        <h1 class='mb-4'>Reporte de Migración MySQL</h1>
        <div class='chart-container'>
            <canvas id="grafico-mysql"></canvas>
        </div>
        <script>
            const ctx = document.getElementById('grafico-mysql');
            new Chart(ctx, {
                type: '${grafico.type}',
                data: {
                    labels: ${grafico.labels},
                    datasets: [{
                        label: '${grafico.title}',
                        data: ${grafico.data},
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Tiempo (ms)'
                            }
                        }
                    }
                }
            });
        </script>
    </main>
    `;

    reporte.Generar();
    console.log('Reporte generado: reporte.html');
})();