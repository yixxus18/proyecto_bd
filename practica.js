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
        const matricula = Math.random()
            .toFixed(7)
            .replace('.', '')
            .padStart(8, '0') 
            .slice(0, 8);
        const año = random_number(0, 999);
        const nombre = random_text(random_number(5, 20));
        csv += `${matricula},${año},"${nombre}"\r\n`;
    }
    return csv;
}

async function executeMySQLCommand(command) {
    const process = new Process("mysql"); 
    process.ProcessArguments.push("-uroot");
    process.ProcessArguments.push("--password=utt");
    process.ProcessArguments.push("--local-infile=1"); 
    process.ProcessArguments.push("--protocol=TCP");
    process.ProcessArguments.push("--enable-local-infile");
    process.Execute();
    process.Write(command);
    process.End();
    await process.Finish();
    return process.EndTime - process.StartTime;
}

(async () => {
    const NUM = 15000;
    const metricas = {
        generatedata: 0,
        selecttime: 0,
        generatecsv: 0,
        importTime: 0,
    };

    const deleteCommands = `
        USE alumnos;
        TRUNCATE TABLE alumno;
    `;
    metricas.deleteTime = await executeMySQLCommand(deleteCommands);

    const exportStart = Date.now();
    require('fs').writeFileSync("C:/tmp/datos_generados.csv", generate_data(NUM));
    metricas.generatedata = Date.now() - exportStart;

    const importCommands = `
        USE alumnos;
        LOAD DATA LOCAL INFILE 'C:/tmp/datos_generados.csv'
        INTO TABLE alumnos.alumno
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n'
    `;
    metricas.importTime = await executeMySQLCommand(importCommands);

    const fs = require('fs');
    const exportFile = "C:\\tmp\\export.csv";
    if (fs.existsSync(exportFile)) {
        fs.unlinkSync(exportFile);
    }

    const exportCommands = `
        USE alumnos;
        SELECT matricula, año , nombre
        FROM alumno
        WHERE año >= 100 AND año <= 750
        INTO OUTFILE 'C:/tmp/export.csv'
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n';
    `;
    metricas.exportTime = await executeMySQLCommand(exportCommands);

    const truncatepractica = `
        USE alumnos;
        TRUNCATE TABLE practica;
    `;

    metricas.truncatepractica = await executeMySQLCommand(truncatepractica);
    
    const importss = `
        USE alumnos;
        LOAD DATA LOCAL INFILE 'C:/tmp/export.csv'
        INTO TABLE practica
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\n'
        (x, y, z);
    `;
    metricas.import = await executeMySQLCommand(importss);


    const reporte = new GeneradorReporte();
    const grafico = {
        type: 'bar',
        labels: "['generatedata', 'selecttime', 'generatecsv', 'importTime']",
        title: 'Tareas de practica MySQL',
        data: `[ ${metricas.generatedata}, ${metricas.selecttime}, ${metricas.generatecsv}, ${metricas.importTime}]`
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