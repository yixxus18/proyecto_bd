const Process = require("./utils/Process");
const GeneradorReporte = require("./generador");
const fs = require('fs');
const path = require('path');

// Configuración
const DB_NAME = 'biblioteca';
const TMP_DIR = 'C:/tmp/';
const NUM_LIBROS = 100000;
const NUM_AUTORES = 150000;
const NUM_STRESS = 3500;
const NUM_CSVS = 100;
const NUM_MONGO_LIBROS = 1000000;

// Helpers
function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomText(length) {
    return Array(length).fill().map(() => String.fromCharCode(randomNumber(65, 90))).join('');
}

function randomISBN() {
    return randomText(13); // ISBN-13
}

function randomYear() {
    return randomNumber(1900, 2023);
}

// Generadores de datos
function generateLibrosCSV(rows, outputFile = null) {
    if (outputFile) {
        // Si se proporciona un archivo, escribir directamente en él
        const writeStream = fs.createWriteStream(outputFile);
        for (let i = 0; i < rows; i++) {
            const row = [
                i + 1,
                randomISBN(),
                randomText(randomNumber(10, 50)),
                randomText(12), // licencia autor
                randomText(10), // editorial
                randomNumber(50, 1000),
                randomYear(),
                randomText(10), // género
                'ES', // idioma
                'PDF', // formato
                randomText(100), // sinopsis
                randomText(500) // contenido
            ].join(',') + '\n';
            writeStream.write(row);
        }
        writeStream.end();
        return new Promise((resolve) => writeStream.on('finish', resolve));
    } else {
        // Si no hay archivo, retornar como string (para cantidades pequeñas)
        let csv = '';
        for (let i = 0; i < rows; i++) {
            csv += [
                i + 1,
                randomISBN(),
                randomText(randomNumber(10, 50)),
                randomText(12), // licencia autor
                randomText(10), // editorial
                randomNumber(50, 1000),
                randomYear(),
                randomText(10), // género
                'ES', // idioma
                'PDF', // formato
                randomText(100), // sinopsis
                randomText(500) // contenido
            ].join(',') + '\n';
        }
        return csv;
    }
}

function generateAutoresCSV(rows) {
    let csv = '';
    for (let i = 0; i < rows; i++) {
        csv += [
            i + 1,
            randomText(12), // licencia
            randomText(10), // nombre
            randomText(10), // apellido
            randomText(10), // segundo apellido
            randomYear()
        ].join(',') + '\n';
    }
    return csv;
}

// MySQL executor
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

// MongoDB executor
async function executeMongoCommand(command, collection) {
    const process = new Process("mongoimport");
    process.ProcessArguments.push(...[
        `--uri=mongodb://localhost:27017/${DB_NAME}`,
        `--collection=${collection}`,
        `--file=${command}`,
        "--type=csv",
        "--headerline"
    ]);
    await process.ExecuteAsync(true);
    return process.EndTime - process.StartTime;
}

// Nuevo: MongoDB export executor
async function executeMongoExport(collection, fields, outputFile) {
    const process = new Process("mongoexport");
    process.ProcessArguments.push(...[
        `--uri=mongodb://localhost:27017/${DB_NAME}`,
        `--collection=${collection}`,
        `--type=csv`,
        `--fields=${fields}`,
        `--out=${outputFile}`
    ]);
    await process.ExecuteAsync(true);
    return process.EndTime - process.StartTime;
}

async function main() {
    console.log('Iniciando proceso...');
    
    const metricas = {
        crear_estructura: 0,
        crear_usuarios: 0,
        generar_100k_libros: 0,
        insertar_100k_libros: 0,
        insertar_3500_libros: 0,
        generar_100csvs: 0,
        insertar_100csvs: 0,
        query_estadisticas: 0,
        generar_150k_autores: 0,
        insertar_150k_autores: 0,
        exportar_csv: 0,
        mongodb_backup: 0,
        mysqldump: 0,
        import_dump: 0,
        error_insert_autor: 0,
        error_insert_libro: 0,
        mongo_export: 0,
        old_books_import: 0
    };

    try {
        // Crear estructura de base de datos
        console.log('Creando estructura de base de datos...');
        const startEstructura = Date.now();
        await executeMySQLCommand(`CREATE DATABASE IF NOT EXISTS ${DB_NAME};`);
        console.log('Base de datos creada.');
        
        await executeMySQLCommand(`
            USE ${DB_NAME};
            CREATE TABLE IF NOT EXISTS Autor (
                id INT PRIMARY KEY,
                license VARCHAR(12) NOT NULL,
                name TINYTEXT NOT NULL,
                lastName TINYTEXT,
                secondLastName TINYTEXT,
                year SMALLINT
            );
            CREATE TABLE IF NOT EXISTS Libro (
                id INT PRIMARY KEY,
                ISBN VARCHAR(16) NOT NULL,
                title VARCHAR(512) NOT NULL,
                autor_license VARCHAR(12),
                editorial TINYTEXT,
                pages SMALLINT,
                year SMALLINT NOT NULL,
                genre TINYTEXT,
                language TINYTEXT NOT NULL,
                format TINYTEXT,
                sinopsis TEXT,
                content TEXT
            );
        `);
        console.log('Tablas creadas.');
        metricas.crear_estructura = Date.now() - startEstructura;

        // Crear usuarios
        const startUsuarios = Date.now();
        await executeMySQLCommand(`
            CREATE USER 'A'@'localhost' IDENTIFIED BY 'passwordA';
            GRANT INSERT, SELECT ON ${DB_NAME}.Libro TO 'A'@'localhost';
            GRANT SELECT ON ${DB_NAME}.Autor TO 'A'@'localhost';
            
            CREATE USER 'B'@'localhost' IDENTIFIED BY 'passwordB';
            GRANT INSERT, SELECT ON ${DB_NAME}.Autor TO 'B'@'localhost';
            GRANT SELECT ON ${DB_NAME}.Libro TO 'B'@'localhost';
        `);
        metricas.crear_usuarios = Date.now() - startUsuarios;

        // Generar e insertar 100k libros
        const csv100k = path.join(TMP_DIR, 'libros_100k.csv');
        let start = Date.now();
        fs.writeFileSync(csv100k, generateLibrosCSV(NUM_LIBROS));
        metricas.generar_100k_libros = Date.now() - start;

        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            LOAD DATA LOCAL INFILE '${csv100k}'
            INTO TABLE Libro
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\n';
        `);
        metricas.insertar_100k_libros = Date.now() - start;

        // Insertar 3500 libros (estrés)
        start = Date.now();
        const stressData = generateLibrosCSV(NUM_STRESS);
        await executeMySQLCommand(`
            USE ${DB_NAME};
            INSERT INTO Libro VALUES ${stressData.split('\n').map(row => 
                `(${row})`).join(',')};
        `);
        metricas.insertar_3500_libros = Date.now() - start;

        // Generar 100 CSVs
        start = Date.now();
        for (let i = 0; i < NUM_CSVS; i++) {
            fs.writeFileSync(path.join(TMP_DIR, `libros_${i}.csv`), 
                generateLibrosCSV(1000));
        }
        metricas.generar_100csvs = Date.now() - start;

        // Insertar 100 CSVs
        start = Date.now();
        for (let i = 0; i < NUM_CSVS; i++) {
            await executeMySQLCommand(`
                USE ${DB_NAME};
                LOAD DATA LOCAL INFILE '${path.join(TMP_DIR, `libros_${i}.csv`)}'
                INTO TABLE Libro;
            `);
        }
        metricas.insertar_100csvs = Date.now() - start;

        // Query estadísticas
        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            SELECT 
                MAX(pages) AS max_pag,
                MIN(pages) AS min_pag,
                AVG(pages) AS avg_pag,
                MAX(year) AS max_year,
                MIN(year) AS min_year,
                COUNT(*) AS total
            FROM Libro;
        `);
        metricas.query_estadisticas = Date.now() - start;

        // Generar e insertar 150k autores
        const csvAutores = path.join(TMP_DIR, 'autores_150k.csv');
        start = Date.now();
        fs.writeFileSync(csvAutores, generateAutoresCSV(NUM_AUTORES));
        metricas.generar_150k_autores = Date.now() - start;

        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            LOAD DATA LOCAL INFILE '${csvAutores}'
            INTO TABLE Autor;
        `);
        metricas.insertar_150k_autores = Date.now() - start;

        // Exportar a CSV
        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            SELECT * FROM Libro INTO OUTFILE '${path.join(TMP_DIR, 'libros_export.csv')}';
            SELECT * FROM Autor INTO OUTFILE '${path.join(TMP_DIR, 'autores_export.csv')}';
        `);
        metricas.exportar_csv = Date.now() - start;

        // MongoDB Backup completo
        start = Date.now();
        console.log('Iniciando respaldo a MongoDB...');
        await executeMongoCommand(path.join(TMP_DIR, 'libros_export.csv'), 'libros');
        await executeMongoCommand(path.join(TMP_DIR, 'autores_export.csv'), 'autores');
        
        // Eliminar tablas de MySQL
        console.log('Eliminando tablas de MySQL...');
        await executeMySQLCommand(`
            USE ${DB_NAME};
            DROP TABLE Libro;
            DROP TABLE Autor;
        `);
        
        // Exportar de MongoDB y restaurar en MySQL
        console.log('Exportando desde MongoDB y restaurando en MySQL...');
        const mongoLibrosExport = path.join(TMP_DIR, 'mongo_libros_export.csv');
        const mongoAutoresExport = path.join(TMP_DIR, 'mongo_autores_export.csv');
        
        await executeMongoExport('libros', '*', mongoLibrosExport);
        await executeMongoExport('autores', '*', mongoAutoresExport);
        
        // Recrear tablas y restaurar datos
        await executeMySQLCommand(`
            USE ${DB_NAME};
            CREATE TABLE IF NOT EXISTS Autor (
                id INT PRIMARY KEY,
                license VARCHAR(12) NOT NULL,
                name TINYTEXT NOT NULL,
                lastName TINYTEXT,
                secondLastName TINYTEXT,
                year SMALLINT
            );
            CREATE TABLE IF NOT EXISTS Libro (
                id INT PRIMARY KEY,
                ISBN VARCHAR(16) NOT NULL,
                title VARCHAR(512) NOT NULL,
                autor_license VARCHAR(12),
                editorial TINYTEXT,
                pages SMALLINT,
                year SMALLINT NOT NULL,
                genre TINYTEXT,
                language TINYTEXT NOT NULL,
                format TINYTEXT,
                sinopsis TEXT,
                content TEXT
            );
            
            LOAD DATA LOCAL INFILE '${mongoLibrosExport}'
            INTO TABLE Libro
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\n'
            IGNORE 1 LINES;
            
            LOAD DATA LOCAL INFILE '${mongoAutoresExport}'
            INTO TABLE Autor
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\n'
            IGNORE 1 LINES;
        `);
        metricas.mongodb_backup = Date.now() - start;

        // MySQL Dump
        start = Date.now();
        const dumpProcess = new Process("mysqldump");
        dumpProcess.ProcessArguments.push(...[
            "-uroot",
            "--password=utt",
            DB_NAME,
            `--result-file=${path.join(TMP_DIR, 'backup.sql')}`
        ]);
        await dumpProcess.ExecuteAsync(true);
        metricas.mysqldump = dumpProcess.EndTime - dumpProcess.StartTime;

        // Restaurar backup
        start = Date.now();
        const restoreProcess = new Process("mysql");
        restoreProcess.ProcessArguments.push(...[
            "-uroot",
            "--password=utt",
            DB_NAME
        ]);
        restoreProcess.Options.shell = true; // <- ¡Clave!
        restoreProcess.ProcessArguments.push(`< "${path.join(TMP_DIR, 'backup.sql')}"`);
        await restoreProcess.ExecuteAsync(true);
        metricas.import_dump = restoreProcess.EndTime - restoreProcess.StartTime;

        // Prueba de error al insertar con usuario no autorizado
        start = Date.now();
        console.log('Probando inserción no autorizada de autor...');
        try {
            await executeMySQLCommand(`
                CREATE USER IF NOT EXISTS 'C'@'localhost' IDENTIFIED BY 'passwordC';
                FLUSH PRIVILEGES;
            `);
            
            const processAutor = new Process("mysql");
            processAutor.ProcessArguments.push("-uC");
            processAutor.ProcessArguments.push("--password=passwordC");
            processAutor.Execute();
            processAutor.Write(`
                USE ${DB_NAME};
                INSERT INTO Autor VALUES (999999, 'TEST', 'TEST', 'TEST', 'TEST', 2000);
            `);
            processAutor.End();
            await processAutor.Finish();
        } catch (error) {
            console.log('Error esperado al insertar autor:', error);
        }
        metricas.error_insert_autor = Date.now() - start;

        // Prueba de error al insertar libro con usuario no autorizado
        start = Date.now();
        console.log('Probando inserción no autorizada de libro...');
        try {
            const processLibro = new Process("mysql");
            processLibro.ProcessArguments.push("-uC");
            processLibro.ProcessArguments.push("--password=passwordC");
            processLibro.Execute();
            processLibro.Write(`
                USE ${DB_NAME};
                INSERT INTO Libro VALUES (999999, 'TEST', 'TEST', 'TEST', 'TEST', 100, 2000, 'TEST', 'ES', 'PDF', 'TEST', 'TEST');
            `);
            processLibro.End();
            await processLibro.Finish();
        } catch (error) {
            console.log('Error esperado al insertar libro:', error);
        }
        metricas.error_insert_libro = Date.now() - start;

        // Generar 1M de libros en MongoDB
        start = Date.now();
        console.log('Generando 1M de libros en MongoDB...');
        const mongoMillionBooks = path.join(TMP_DIR, 'mongo_million_books.csv');
        console.log('Generando archivo CSV grande...');
        await generateLibrosCSV(NUM_MONGO_LIBROS, mongoMillionBooks);
        console.log('Importando a MongoDB...');
        await executeMongoCommand(mongoMillionBooks, 'libros_million');
        
        // Exportar campos específicos
        const mongoExportFields = path.join(TMP_DIR, 'mongo_export_fields.csv');
        await executeMongoExport('libros_million', 'ISBN,year,pages', mongoExportFields);
        metricas.mongo_export = Date.now() - start;

        // Crear tabla old_books e importar datos
        start = Date.now();
        console.log('Creando tabla old_books e importando datos...');
        await executeMySQLCommand(`
            USE ${DB_NAME};
            CREATE TABLE IF NOT EXISTS old_books (
                ISBN VARCHAR(16) NOT NULL,
                year SMALLINT,
                pages SMALLINT
            );
            
            LOAD DATA LOCAL INFILE '${mongoExportFields}'
            INTO TABLE old_books
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\n'
            IGNORE 1 LINES;
        `);
        metricas.old_books_import = Date.now() - start;

        // Generar reporte
        const reporte = new GeneradorReporte();
        const grafico = {
            type: 'bar',
            labels: Object.keys(metricas),
            data: Object.values(metricas)
        };

        reporte.Body = `
        <main class='container mt-5'>
            <h1 class='mb-4'>Reporte de Rendimiento</h1>
            <canvas id="grafico"></canvas>
            <script>
                new Chart(document.getElementById('grafico'), {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(grafico.labels)},
                        datasets: [{
                            label: 'Tiempo (ms)',
                            data: ${JSON.stringify(grafico.data)},
                            backgroundColor: 'rgba(54, 162, 235, 0.5)'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: { y: { beginAtZero: true } }
                    }
                });
            </script>
        </main>
        `;

        reporte.Generar();
    } catch (error) {
        console.error('Error durante la ejecución:', error);
        throw error;
    }
}

main().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});