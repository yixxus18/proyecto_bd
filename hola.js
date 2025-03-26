const Process = require("./utils/Process");
const GeneradorReporte = require("./generador");
const fs = require('fs');
const path = require('path');

const DB_NAME = 'biblioteca';
const TMP_DIR = 'C:/tmp/';
const NUM_LIBROS = 100000;
const NUM_AUTORES = 150000;
const NUM_STRESS = 3500;
const NUM_CSVS = 100;
const NUM_MONGO_LIBROS = 1000000;

function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomText(length) {
    return Array(length).fill().map(() => String.fromCharCode(randomNumber(65, 90))).join('');
}

function randomISBN() {
    return randomText(13);
}

function randomYear() {
    return randomNumber(1900, 2023);
}

function generateLibrosCSV(rows, outputFile = null) {
    if (outputFile) {
        const writeStream = fs.createWriteStream(outputFile);
        for (let i = 0; i < rows; i++) {
            const row = [
                i + 1,
                randomISBN(),
                randomText(randomNumber(10, 50)),
                randomText(12), 
                randomText(10), 
                randomNumber(50, 1000),
                randomYear(),
                randomText(10), 
                'ES', 
                'PDF', 
                randomText(100), 
                randomText(500) 
            ].join(',') + '\n';
            writeStream.write(row);
        }
        writeStream.end();
        return new Promise((resolve) => writeStream.on('finish', resolve));
    } else {
        let csv = '';
        for (let i = 0; i < rows; i++) {
            csv += [
                i + 1,
                randomISBN(),
                randomText(randomNumber(10, 50)),
                randomText(12), 
                randomText(10), 
                randomNumber(50, 1000),
                randomYear(),
                randomText(10), 
                'ES', 
                'PDF', 
                randomText(100), 
                randomText(500) 
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
            randomText(12), 
            randomText(10), 
            randomText(10), 
            randomText(10),
            randomYear()
        ].join(',') + '\n';
    }
    return csv;
}

async function executeMySQLCommand(command) {
    const process = new Process("C:\\MySQL\\bin\\mysql");
    process.ProcessArguments.push("-uroot");
    process.ProcessArguments.push("--password=utt");
    process.ProcessArguments.push("--local-infile=1");
    process.ProcessArguments.push("--enable-local-infile");
    process.ProcessArguments.push("--init-command=SET GLOBAL local_infile=1");
    process.Execute();
    process.Write(command);
    process.End();
    await process.Finish();
    return process.EndTime - process.StartTime;
}

async function executeMongoCommand(command, collection) {
    const process = new Process("C:\\mongodb\\bin\\mongoimport");
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

async function executeMongoExport(collection, fields, outputFile) {
    const process = new Process("C:\\mongodb\\bin\\mongoexport");
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

        const csv100k = path.join(TMP_DIR, 'libros_100k.csv');
        let start = Date.now();
        require('fs').writeFileSync(csv100k, generateLibrosCSV(NUM_LIBROS));
        metricas.generar_100k_libros = Date.now() - start;

        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            SET GLOBAL local_infile=1;
            LOAD DATA LOCAL INFILE '${csv100k.replace(/\\/g, '/')}'
            INTO TABLE Libro
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n';
        `);
        metricas.insertar_100k_libros = Date.now() - start;

        start = Date.now();
        await executeMySQLCommand(`
            USE ${DB_NAME};
            WITH RECURSIVE numbers AS (
                SELECT 1 AS n
                UNION ALL
                SELECT n + 1 FROM numbers WHERE n < ${NUM_STRESS}
            )
            INSERT INTO Libro (
                id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content
            )
            SELECT 
                n,
                SUBSTRING(MD5(RAND()),1,13),
                SUBSTRING(MD5(RAND()),1, FLOOR(10 + RAND()*40)),
                SUBSTRING(MD5(RAND()),1,12),
                SUBSTRING(MD5(RAND()),1,10),
                FLOOR(50 + RAND()*950),
                FLOOR(1900 + RAND()*(2023-1900)),
                SUBSTRING(MD5(RAND()),1,10),
                'ES',
                'PDF',
                SUBSTRING(MD5(RAND()),1,100),
                SUBSTRING(MD5(RAND()),1,500)
            FROM numbers;
        `);
        metricas.insertar_3500_libros = Date.now() - start;
        
        start = Date.now();
        for (let i = 0; i < NUM_CSVS; i++) {
            fs.writeFileSync(path.join(TMP_DIR, `libros_${i}.csv`), 
                generateLibrosCSV(1000));
        }
        metricas.generar_100csvs = Date.now() - start;

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
        console.log('Exportando a CSV...');
        
        // Primero obtenemos los datos y luego los escribimos a archivos
        const librosExportPath = path.join(TMP_DIR, 'libros_export.csv');
        const autoresExportPath = path.join(TMP_DIR, 'autores_export.csv');
        
        // Ejecutar queries para obtener los datos
        const librosProcess = new Process("C:\\MySQL\\bin\\mysql");
        librosProcess.ProcessArguments.push("-uroot");
        librosProcess.ProcessArguments.push("--password=utt");
        librosProcess.ProcessArguments.push(DB_NAME);
        librosProcess.ProcessArguments.push("-e");
        librosProcess.ProcessArguments.push("SELECT * FROM Libro");
        librosProcess.ProcessArguments.push("--batch");  // Formato de salida sin decoración
        await librosProcess.ExecuteAsync(true);
        fs.writeFileSync(librosExportPath, librosProcess.Logs);
        
        const autoresProcess = new Process("C:\\MySQL\\bin\\mysql");
        autoresProcess.ProcessArguments.push("-uroot");
        autoresProcess.ProcessArguments.push("--password=utt");
        autoresProcess.ProcessArguments.push(DB_NAME);
        autoresProcess.ProcessArguments.push("-e");
        autoresProcess.ProcessArguments.push("SELECT * FROM Autor");
        autoresProcess.ProcessArguments.push("--batch");  // Formato de salida sin decoración
        await autoresProcess.ExecuteAsync(true);
        fs.writeFileSync(autoresExportPath, autoresProcess.Logs);
        
        console.log(`Archivos CSV creados: 
          - ${librosExportPath}
          - ${autoresExportPath}`);
        
        metricas.exportar_csv = Date.now() - start;

        // MongoDB Backup completo
        start = Date.now();
        console.log('Iniciando respaldo a MongoDB...');
        
        // Preparamos los archivos CSV correctamente para MongoDB
        const librosMongoCSV = path.join(TMP_DIR, 'libros_mongo.csv');
        const autoresMongoCSV = path.join(TMP_DIR, 'autores_mongo.csv');
        
        // Obtener datos limpios para MongoDB
        const librosMongoProcess = new Process("C:\\MySQL\\bin\\mysql");
        librosMongoProcess.ProcessArguments.push("-uroot");
        librosMongoProcess.ProcessArguments.push("--password=utt");
        librosMongoProcess.ProcessArguments.push(DB_NAME);
        librosMongoProcess.ProcessArguments.push("-e");
        librosMongoProcess.ProcessArguments.push("SELECT * FROM Libro");
        librosMongoProcess.ProcessArguments.push("--csv");  // Formato CSV
        await librosMongoProcess.ExecuteAsync(true);
        fs.writeFileSync(librosMongoCSV, librosMongoProcess.Logs);
        
        const autoresMongoProcess = new Process("C:\\MySQL\\bin\\mysql");
        autoresMongoProcess.ProcessArguments.push("-uroot");
        autoresMongoProcess.ProcessArguments.push("--password=utt");
        autoresMongoProcess.ProcessArguments.push(DB_NAME);
        autoresMongoProcess.ProcessArguments.push("-e");
        autoresMongoProcess.ProcessArguments.push("SELECT * FROM Autor");
        autoresMongoProcess.ProcessArguments.push("--csv");  // Formato CSV
        await autoresMongoProcess.ExecuteAsync(true);
        fs.writeFileSync(autoresMongoCSV, autoresMongoProcess.Logs);
        
        console.log('Archivos CSV preparados para MongoDB');
        await executeMongoCommand(librosMongoCSV, 'libros');
        await executeMongoCommand(autoresMongoCSV, 'autores');
        console.log('Importación a MongoDB completada');
        
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
        
        console.log('Exportando desde MongoDB...');
        await executeMongoExport('libros', 'id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content', mongoLibrosExport);
        await executeMongoExport('autores', 'id,license,name,lastName,secondLastName,year', mongoAutoresExport);
        console.log('Exportación completada');
        
        // Verificar si se crearon los archivos
        console.log(`Verificando archivos exportados:
          - ${fs.existsSync(mongoLibrosExport) ? 'Libros: OK' : 'Libros: NO EXISTE'}
          - ${fs.existsSync(mongoAutoresExport) ? 'Autores: OK' : 'Autores: NO EXISTE'}`);
        
        // Recrear tablas y restaurar datos
        console.log('Recreando tablas y restaurando datos...');
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
        
        // Cargar datos desde archivos CSV
        if (fs.existsSync(mongoLibrosExport)) {
            await executeMySQLCommand(`
                USE ${DB_NAME};
                SET GLOBAL local_infile=1;
                LOAD DATA LOCAL INFILE '${mongoLibrosExport.replace(/\\/g, '/')}'
                INTO TABLE Libro
                FIELDS TERMINATED BY ','
                LINES TERMINATED BY '\\n'
                IGNORE 1 LINES;
            `);
            console.log('Datos de libros restaurados');
        } else {
            console.log('Error: Archivo de libros no encontrado');
        }
        
        if (fs.existsSync(mongoAutoresExport)) {
            await executeMySQLCommand(`
                USE ${DB_NAME};
                SET GLOBAL local_infile=1;
                LOAD DATA LOCAL INFILE '${mongoAutoresExport.replace(/\\/g, '/')}'
                INTO TABLE Autor
                FIELDS TERMINATED BY ','
                LINES TERMINATED BY '\\n'
                IGNORE 1 LINES;
            `);
            console.log('Datos de autores restaurados');
        } else {
            console.log('Error: Archivo de autores no encontrado');
        }

        metricas.mongodb_backup = Date.now() - start;

        // MySQL Dump
        start = Date.now();
        console.log('Generando dump de MySQL...');
        const dumpProcess = new Process("C:\\MySQL\\bin\\mysqldump");
        dumpProcess.ProcessArguments.push(...[
            "-uroot",
            "--password=utt",
            DB_NAME,
            `--result-file=${path.join(TMP_DIR, 'backup.sql')}`
        ]);
        await dumpProcess.ExecuteAsync(true);
        metricas.mysqldump = dumpProcess.EndTime - dumpProcess.StartTime;
        console.log('Dump generado correctamente');

        // Restaurar backup
        start = Date.now();
        console.log('Restaurando desde backup...');
        const restoreProcess = new Process("C:\\MySQL\\bin\\mysql");
        restoreProcess.ProcessArguments.push(...[
            "-uroot",
            "--password=utt",
            DB_NAME
        ]);
        restoreProcess.Options.shell = true; // <- ¡Clave!
        restoreProcess.ProcessArguments.push(`< "${path.join(TMP_DIR, 'backup.sql')}"`);
        await restoreProcess.ExecuteAsync(true);
        metricas.import_dump = restoreProcess.EndTime - restoreProcess.StartTime;
        console.log('Restauración completada');

        // Prueba de error al insertar con usuario no autorizado
        start = Date.now();
        console.log('Probando inserción no autorizada de autor...');
        try {
            await executeMySQLCommand(`
                CREATE USER IF NOT EXISTS 'C'@'localhost' IDENTIFIED BY 'passwordC';
                FLUSH PRIVILEGES;
            `);
            
            const processAutor = new Process("C:\\MySQL\\bin\\mysql");
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
            const processLibro = new Process("C:\\MySQL\\bin\\mysql");
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