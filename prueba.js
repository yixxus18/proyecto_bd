const Process = require("./utils/Process");
const GeneradorReporte = require("./generador");

function random_number(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function random_text(characters_num) {
    let text = "";
    for(let i = 0; i < characters_num; i++) {
        const letra = String.fromCharCode(random_number(65, 89));
        text += letra;
    }

    return text;
}

function generate_data(size) {
    let csv = "";
    for (let i = 0; i < size; i++) {
        const edad = Math.random().toFixed(3).toString().replace('.', '');
        const nombre = random_text(random_number(5, 20));
        const texto = random_text(random_number(5, 20));
        csv += `${edad},${nombre},${texto}\n`;
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
    const NUM = 50000;
    const metricas = {
        importTime: 0,
        queryTime: 0
    };

    require('fs').writeFileSync("C:\\tmp\\datos_generados.csv", generate_data(NUM));

    const importCommands = `
        USE examen;
        LOAD DATA LOCAL INFILE 'C:\\\\tmp\\\\datos_generados.csv'
        INTO TABLE datos
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\\n'
        (edad, nombre, texto);
    `;
    metricas.importTime = await executeMySQLCommand(importCommands);

    metricas.queryTime = await executeMySQLCommand("SELECT COUNT(*) FROM datos");

    const reporte = new GeneradorReporte();
    const grafico = {
        type: 'bar',
        labels: "['Import', 'Query']",
        title: 'Tareas de migración MySQL',
        data: `[ ${metricas.importTime}, ${metricas.queryTime}]`
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