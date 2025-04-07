const Process = require("./utils/Process");
const GeneradorReporte = require("./generador");
const fs = require('fs');
const path = require('path');

const CONFIG = {
  DB_NAME: 'biblioteca',
  PATHS: {
    TMP_DIR: 'C:/tmp/',
    MONGODB_BIN: 'C:/mongodb/bin/',
    MYSQL_BIN: 'C:/MySQL/bin/'
  },
  CREDENTIALS: {
    mysql: {
      root: { user: 'root', password: 'utt' },
      A: { user: 'A', password: 'passwordA' },
      B: { user: 'B', password: 'passwordB' },
      C: { user: 'C', password: 'passwordC' }
    },
    mongo: { uri: 'mongodb://localhost:27017/' }
  },
  LIMITS: {
    LIBROS: 100000,
    AUTORES: 150000,
    STRESS: 3500,
    CSVS: 100,
    MONGO_LIBROS: 1000000
  }
};

process.env.PATH += `;${CONFIG.PATHS.MONGODB_BIN};${CONFIG.PATHS.MYSQL_BIN}`;

const random = {
  number: (min, max) => Math.floor(Math.random() * (max - min) + min),
  text: (length) => Array.from({ length }, () => 
    String.fromCharCode(random.number(65, 90))).join(''),
  isbn: () => random.text(13),
  year: () => random.number(1900, new Date().getFullYear()),
  md5: (length) => Array.from({ length }, () => 
    Math.random().toString(36).substr(2, 1)).join('')
};

async function generateLibrosCSV(rows, outputFile, autorLicense) {
  const headers = 'id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content\n';
  const stream = fs.createWriteStream(outputFile);
  stream.write(headers);

  for (let i = 0; i < rows; i++) {
    const row = [
      i + 1,
      random.isbn(),
      random.text(random.number(10, 50)),
      autorLicense,
      random.text(10),
      random.number(50, 1000),
      random.year(),
      random.text(10),
      'ES',
      'PDF',
      random.text(100),
      random.text(500)
    ].join(',');
    
    if (!stream.write(row + '\n')) {
      await new Promise(resolve => stream.once('drain', resolve));
    }
  }
  
  stream.end();
  return new Promise(resolve => stream.on('finish', resolve));
}

async function generateAutoresCSV(rows, outputFile) {
  const headers = 'id,license,name,lastName,secondLastName,year\n';
  const stream = fs.createWriteStream(outputFile);
  stream.write(headers);

  for (let i = 0; i < rows; i++) {
    const row = [
      i + 1,
      random.text(12),
      random.text(10),
      random.text(10),
      random.text(10),
      random.year()
    ].join(',');
    
    if (!stream.write(row + '\n')) {
      await new Promise(resolve => stream.once('drain', resolve));
    }
  }
  
  stream.end();
  return new Promise(resolve => stream.on('finish', resolve));
}

async function executeMySQLCommand(command, user = 'root') {
    const process = new Process("mysql");
    const creds = CONFIG.CREDENTIALS.mysql[user];
    
    process.ProcessArguments.push(
        `-u${creds.user}`,
        `--password=${creds.password}`,
        '--local-infile=1',
        '--enable-local-infile'
    );
    
    if (command && command.trim()) {
        process.ProcessArguments.push('-e', command);
    }
    
    await process.ExecuteAsync(true);
    
    if (process.ErrorsLog && !process.ErrorsLog.includes('[Warning]')) {
        console.error(`Error MySQL: ${process.ErrorsLog}`);
        throw new Error(process.ErrorsLog);
    }
    
    return process.EndTime - process.StartTime;
}

async function executeMongoCommand(command, collection, fields) {
  const process = new Process("mongoimport");
  process.ProcessArguments.push(
      `--uri=${CONFIG.CREDENTIALS.mongo.uri}${CONFIG.DB_NAME}`,
      `--collection=${collection}`,
      `--file=${command}`,
      "--type=csv",
      "--headerline"
  );
  
  await process.ExecuteAsync(true);
  
  if (process.ErrorsLog) {
    console.error(`Error MongoDB: ${process.ErrorsLog}`);
  }
  
  return process.EndTime - process.StartTime;
}

async function executeCommand(command, args = []) {
  const process = new Process(command);
  
  if (args && args.length > 0) {
    process.ProcessArguments.push(...args);
  }
  
  await process.ExecuteAsync(true);
  return process.EndTime - process.StartTime;
}

async function executeMongoExport(collection, fields, outputFile) {
  const process = new Process("mongoexport");
  process.ProcessArguments.push(
    `--uri=${CONFIG.CREDENTIALS.mongo.uri}${CONFIG.DB_NAME}`,
    `--collection=${collection}`,
    '--type=csv',
    `--fields=${fields}`,
    `--out=${outputFile}`
  );
  
  await process.ExecuteAsync(true);  
  return process.EndTime - process.StartTime;
}

async function main() {
    const metricas = {};
    const timer = (name) => {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            console.log(`[${name}] ${duration}ms`);
            return duration;
        };
    };

    try {
        console.log("Iniciando pruebas de rendimiento...");
        
        let time = timer('crear_estructura');
        await executeMySQLCommand(`DROP DATABASE IF EXISTS ${CONFIG.DB_NAME}`);
        await executeMySQLCommand(`CREATE DATABASE IF NOT EXISTS ${CONFIG.DB_NAME}`);
        await executeMySQLCommand(`
            CREATE TABLE ${CONFIG.DB_NAME}.Autor (
            id INT PRIMARY KEY,
            license VARCHAR(12) NOT NULL UNIQUE,
            name TINYTEXT NOT NULL,
            lastName TINYTEXT,
            secondLastName TINYTEXT,
            year SMALLINT
            ) ENGINE=InnoDB;
        `);
        await executeMySQLCommand(`
            CREATE TABLE ${CONFIG.DB_NAME}.Libro (
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
            content TEXT,
            FOREIGN KEY (autor_license) REFERENCES Autor(license)
            ) ENGINE=InnoDB;
        `);
        metricas.crear_estructura = time();

        console.log("Creando usuarios...");
        time = timer('crear_usuarios');
        await executeMySQLCommand(`
            DROP USER IF EXISTS 'A'@'localhost';
            DROP USER IF EXISTS 'B'@'localhost';
            DROP USER IF EXISTS 'C'@'localhost';
            
            CREATE USER 'A'@'localhost' IDENTIFIED BY 'passwordA';
            GRANT INSERT, SELECT ON ${CONFIG.DB_NAME}.Libro TO 'A'@'localhost';
            GRANT SELECT ON ${CONFIG.DB_NAME}.Autor TO 'A'@'localhost';
            
            CREATE USER 'B'@'localhost' IDENTIFIED BY 'passwordB';
            GRANT INSERT, SELECT ON ${CONFIG.DB_NAME}.Autor TO 'B'@'localhost';
            GRANT SELECT ON ${CONFIG.DB_NAME}.Libro TO 'B'@'localhost';
            
            CREATE USER 'C'@'localhost' IDENTIFIED BY 'passwordC';
            
            FLUSH PRIVILEGES;
        `);
        metricas.crear_usuarios = time();

        console.log("Creando autor único para todos los libros...");
        const autorLicense = random.text(12);
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            INSERT INTO ${CONFIG.DB_NAME}.Autor VALUES (0, '${autorLicense}', 'AUTOR', 'PRINCIPAL', 'UNICO', 2023);
        `, 'B');
        console.log(`Autor creado con licencia: ${autorLicense}`);

        console.log("Generando 150k autores");
        const autores150k = path.join(CONFIG.PATHS.TMP_DIR, 'autores_150k.csv');
        time = timer('generar_150k_autores');
        await generateAutoresCSV(CONFIG.LIMITS.AUTORES, autores150k);
        metricas.generar_150k_autores = time();
        
        console.log("Insertando autores...");
        time = timer('insertar_150k_autores');
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            LOAD DATA LOCAL INFILE '${autores150k.replace(/\\/g, '/')}'
            INTO TABLE Autor
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n'
            IGNORE 1 ROWS
            (id, license, name, lastName, secondLastName, year);
        `, 'B');
        metricas.insertar_150k_autores = time();

        console.log("Generando libros...");
        const libros100k = path.join(CONFIG.PATHS.TMP_DIR, 'libros_100ks.csv');
        time = timer('generar_100k_libros');
        await generateLibrosCSV(CONFIG.LIMITS.LIBROS, libros100k, autorLicense);
        metricas.generar_100k_libros = time();

        console.log("Insertando libros...");
        time = timer('insertar_100k_libros');
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            LOAD DATA LOCAL INFILE '${libros100k.replace(/\\/g, '/')}'
            INTO TABLE ${CONFIG.DB_NAME}.Libro
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n'
            IGNORE 1 ROWS
            (id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content);
        `, 'A');
        metricas.insertar_100k_libros = time();

        console.log("Prueba de estrés...");
        const startIdStress = CONFIG.LIMITS.LIBROS + 1;
        time = timer('insertar_3500_libros');
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
    
            INSERT INTO Libro (id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content)
            SELECT
                ${startIdStress} + t.row_num - 1 AS id,
                CONCAT('STRESS', LPAD(t.row_num, 8, '0')) AS ISBN,
                CONCAT('Libro de estrés ', t.row_num) AS title,
                '${autorLicense}',
                CONCAT('Editorial ', t.row_num) AS editorial,
                FLOOR(50 + RAND() * 950) AS pages,
                FLOOR(1900 + RAND() * (YEAR(CURDATE()) - 1900 + 1)) AS year,
                'PRUEBA' AS genre,
                'ES' AS language,
                'PDF' AS format,
                CONCAT('Sinopsis de prueba ', t.row_num) AS sinopsis,
                CONCAT('Contenido de prueba ', t.row_num) AS content
            FROM (
                SELECT
                    (@stress_row := @stress_row + 1) AS row_num
                FROM
                    information_schema.tables AS T1
                    CROSS JOIN information_schema.tables AS T2
                    CROSS JOIN (SELECT @stress_row := 0) AS init
                LIMIT ${CONFIG.LIMITS.STRESS}
            ) AS t;
        `, 'A');
        metricas.insertar_3500_libros = time();

        console.log("Generando 100 CSVs...");
        time = timer('generar_100csvs');
        const csvPromises = [];
        let startId = 103501; 

        for (let i = 0; i < CONFIG.LIMITS.CSVS; i++) {
            const csvPath = path.join(CONFIG.PATHS.TMP_DIR, `libros_${i}.csv`);

            const generateCSVWithConsecutiveIds = async (startIndex, count, outputFile, autorLicense) => {
                const headers = 'id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content\n';
                const stream = fs.createWriteStream(outputFile);
                stream.write(headers);

                for (let j = 0; j < count; j++) {
                    const row = [
                        startIndex + j, 
                        random.isbn(),
                        random.text(random.number(10, 50)),
                        autorLicense,
                        random.text(10),
                        random.number(50, 1000),
                        random.year(),
                        random.text(10),
                        'ES',
                        'PDF',
                        random.text(100),
                        random.text(500)
                    ].join(',');
                    
                    if (!stream.write(row + '\n')) {
                        await new Promise(resolve => stream.once('drain', resolve));
                    }
                }
                
                stream.end();
                return new Promise(resolve => stream.on('finish', resolve));
            };
            
            csvPromises.push(generateCSVWithConsecutiveIds(startId, 1000, csvPath, autorLicense));
            startId += 1000; 
        }
        await Promise.all(csvPromises);
        metricas.generar_100csvs = time();

        console.log("Insertando 100 CSVs...");
        time = timer('insertar_100csvs');
        for (let i = 0; i < CONFIG.LIMITS.CSVS; i++) {
            const csvPath = path.join(CONFIG.PATHS.TMP_DIR, `libros_${i}.csv`);
            await executeMySQLCommand(`
                USE ${CONFIG.DB_NAME};
                LOAD DATA LOCAL INFILE '${csvPath.replace(/\\/g, '/')}'
                INTO TABLE ${CONFIG.DB_NAME}.Libro
                FIELDS TERMINATED BY ','
                LINES TERMINATED BY '\\n'
                IGNORE 1 ROWS
                (id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content);
            `, 'A');
        }
        metricas.insertar_100csvs = time();

        console.log("Consulta estadísticas...");
        time = timer('query_estadisticas');
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            SELECT 
                MAX(pages) AS max_pag,
                MIN(pages) AS min_pag,
                AVG(pages) AS avg_pag,
                MAX(year) AS max_year,
                MIN(year) AS min_year,
                COUNT(*) AS total
            FROM Libro;
        `);
        metricas.query_estadisticas = time();

        console.log("Exportando a MongoDB...");
        time = timer('exportar_csv');

        const librosCompletosCSV = path.join(CONFIG.PATHS.TMP_DIR, 'libros_completos.csv').replace(/\\/g, '/');
        const autoresCompletosCSV = path.join(CONFIG.PATHS.TMP_DIR, 'autores_completos.csv').replace(/\\/g, '/');

        await executeMySQLCommand(
            `(SELECT 'id','ISBN','title','autor_license','editorial','pages','year','genre','language','format','sinopsis','content')
            UNION ALL
            SELECT * FROM ${CONFIG.DB_NAME}.Libro
            INTO OUTFILE '${librosCompletosCSV}'
            FIELDS TERMINATED BY ','
            OPTIONALLY ENCLOSED BY '"'
            LINES TERMINATED BY '\\n'`,
            'root'
        );

        await executeMySQLCommand(
            `(SELECT 'id','license','name','lastName','secondLastName','year')
            UNION ALL
            SELECT * FROM ${CONFIG.DB_NAME}.Autor
            INTO OUTFILE '${autoresCompletosCSV}'
            FIELDS TERMINATED BY ','
            OPTIONALLY ENCLOSED BY '"'
            LINES TERMINATED BY '\\n'`,
            'root'
        );
        
        const [librosExport, autoresExport] = await Promise.all([
            executeMongoCommand(librosCompletosCSV, 'libros', '--fields=id.string(),ISBN.string(),title.string(),autor_license.string(),editorial.string(),pages.string(),year.string(),genre.string(),language.string(),format.string(),sinopsis.string(),content.string()'),
            executeMongoCommand(autoresCompletosCSV, 'autores', '--fields=id.string(),license.string(),name.string(),lastName.string(),secondLastName.string(),year.string()')
        ]);
        metricas.exportar_csv = Math.max(librosExport, autoresExport);

        console.log("Respaldo y restauración: MongoDB → MySQL");
        time = timer('mongodb_backup');

        const tmpAutoresCSV = path.join(CONFIG.PATHS.TMP_DIR, 'tmp_autores.csv').replace(/\\/g, '/');
        const tmpLibrosCSV = path.join(CONFIG.PATHS.TMP_DIR, 'tmp_libros.csv').replace(/\\/g, '/');  
        await Promise.all([
            executeMongoExport('autores', 'id,license,name,lastName,secondLastName,year', tmpAutoresCSV),
            executeMongoExport('libros', 'id,ISBN,title,autor_license,editorial,pages,year,genre,language,format,sinopsis,content', tmpLibrosCSV)
        ]);
        
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            DROP TABLE IF EXISTS Libro;
            DROP TABLE IF EXISTS Autor;
            
            CREATE TABLE ${CONFIG.DB_NAME}.Autor (
                id INT PRIMARY KEY,
                license VARCHAR(12) NOT NULL UNIQUE,
                name TINYTEXT NOT NULL,
                lastName TINYTEXT,
                secondLastName TINYTEXT,
                year SMALLINT
            ) ENGINE=InnoDB;
            
            CREATE TABLE ${CONFIG.DB_NAME}.Libro (
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
                content TEXT,
                FOREIGN KEY (autor_license) REFERENCES Autor(license)
            ) ENGINE=InnoDB;
        `);
        
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            LOAD DATA LOCAL INFILE '${tmpAutoresCSV.replace(/\\/g, '/')}' 
            INTO TABLE ${CONFIG.DB_NAME}.Autor 
            FIELDS TERMINATED BY ',' 
            ENCLOSED BY '"' 
            LINES TERMINATED BY '\\n' 
            IGNORE 1 LINES
            (id, license, name, lastName, secondLastName, year);
        `);
        
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            SET FOREIGN_KEY_CHECKS=0;
            LOAD DATA LOCAL INFILE '${tmpLibrosCSV.replace(/\\/g, '/')}' 
            INTO TABLE ${CONFIG.DB_NAME}.Libro 
            FIELDS TERMINATED BY ',' 
            ENCLOSED BY '"' 
            LINES TERMINATED BY '\\n' 
            IGNORE 1 LINES
            (id, ISBN, title, autor_license, editorial, pages, year, genre, language, format, sinopsis, content);
            SET FOREIGN_KEY_CHECKS=1;
        `);
        
        const totalLibros = await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            SELECT COUNT(*) FROM Libro;
        `);
        console.log('Libros restaurados:', totalLibros);
        
        metricas.mongodb_backup = time();

        console.log("Creando dump MySQL...");
        time = timer('mysqldump');
        const dumpFile = path.join(CONFIG.PATHS.TMP_DIR, 'backup.sql');
        await executeCommand('mysqldump', [
            `-u${CONFIG.CREDENTIALS.mysql.root.user}`,
            `--password=${CONFIG.CREDENTIALS.mysql.root.password}`,
            CONFIG.DB_NAME,
            `--result-file=${dumpFile}`
        ]);
        metricas.mysqldump = time();

        console.log("Importando dump...");
        time = timer('import_dump');
        await executeMySQLCommand(`DROP DATABASE IF EXISTS ${CONFIG.DB_NAME}`);
        await executeMySQLCommand(`CREATE DATABASE ${CONFIG.DB_NAME}`);
        
        await executeCommand('mysql', [
            `-u${CONFIG.CREDENTIALS.mysql.root.user}`,
            `--password=${CONFIG.CREDENTIALS.mysql.root.password}`,
            CONFIG.DB_NAME,
            `-e`,
            `source ${dumpFile}`
        ]);
        metricas.import_dump = time();

        console.log("Prueba de seguridad...");
        time = timer('error_insert_autor');
        try {
            await executeMySQLCommand(`
                USE ${CONFIG.DB_NAME};
                INSERT INTO Autor VALUES (999999, 'TEST123456789', 'TEST', 'TEST', 'TEST', 2000);
            `, 'C');
        } catch (e) { 
            console.log("Error esperado: " + e.message); 
        }
        metricas.error_insert_autor = time();

        time = timer('error_insert_libro');
        try {
            await executeMySQLCommand(`
                USE ${CONFIG.DB_NAME};
                INSERT INTO Libro VALUES (999999, 'TEST', 'TEST', 'TEST', 'TEST', 100, 2000, 'TEST', 'ES', 'PDF', 'TEST', 'TEST');
            `, 'C');
        } catch (e) { 
            console.log("Error esperado: " + e.message);
        }
        metricas.error_insert_libro = time();

        console.log("Generando 1M libros para MongoDB...");
        time = timer('mongo_export');
        const mongoLibros = path.join(CONFIG.PATHS.TMP_DIR, 'mongo_1m.csv');
        await generateLibrosCSV(CONFIG.LIMITS.MONGO_LIBROS, mongoLibros, autorLicense);
        await executeMongoCommand(
            mongoLibros,
            'libros_million',
            "--headerline"
        );
        
        const oldBooksFile = path.join(CONFIG.PATHS.TMP_DIR, 'old_books.csv');
        await executeMongoExport('libros_million', 'ISBN,year,pages', oldBooksFile);
        metricas.mongo_export = time();

        console.log("Importando a old_books...");
        time = timer('old_books_import');
        await executeMySQLCommand(`
            USE ${CONFIG.DB_NAME};
            DROP TABLE IF EXISTS old_books;
            CREATE TABLE old_books (
                ISBN VARCHAR(16) NOT NULL,
                year SMALLINT,
                pages SMALLINT
            );
            
            LOAD DATA LOCAL INFILE '${oldBooksFile.replace(/\\/g, '/')}'
            INTO TABLE old_books
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n'
            IGNORE 1 ROWS;
        `);
        metricas.old_books_import = time();

        console.log("Generando reporte...");
        const reporte = new GeneradorReporte();
        reporte.Body = `
            <div class="container mt-5">
                <h1>Reporte de Rendimiento de Biblioteca</h1>
                <p class="lead">Métricas de rendimiento para operaciones de base de datos</p>
                <div class="row">
                    <div class="col-12">
                        <canvas id="chart" height="400"></canvas>
                    </div>
                </div>
                <div class="row mt-4">
                    <div class="col-12">
                        <h3>Resumen de métricas</h3>
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Operación</th>
                                    <th>Tiempo (ms)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(metricas).map(([key, value]) => 
                                    `<tr>
                                        <td>${key}</td>
                                        <td>${value}</td>
                                    </tr>`
                                ).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <script>
                const ctx = document.getElementById('chart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ${JSON.stringify(Object.keys(metricas))},
                        datasets: [{
                            label: 'Tiempo de ejecución (ms)',
                            data: ${JSON.stringify(Object.values(metricas))},
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.7)',
                                'rgba(255, 99, 132, 0.7)',
                                'rgba(255, 206, 86, 0.7)',
                                'rgba(75, 192, 192, 0.7)',
                                'rgba(153, 102, 255, 0.7)',
                                'rgba(255, 159, 64, 0.7)',
                                'rgba(199, 199, 199, 0.7)',
                                'rgba(83, 102, 255, 0.7)',
                                'rgba(40, 159, 64, 0.7)',
                                'rgba(210, 199, 199, 0.7)',
                                'rgba(78, 250, 137, 0.7)',
                                'rgba(23, 45, 232, 0.7)',
                                'rgba(45, 132, 45, 0.7)',
                                'rgba(255, 182, 193, 0.7)',
                                'rgba(170, 120, 250, 0.7)'
                            ],
                            borderColor: [
                                'rgb(54, 162, 235)',
                                'rgb(255, 99, 132)',
                                'rgb(255, 206, 86)',
                                'rgb(75, 192, 192)',
                                'rgb(153, 102, 255)',
                                'rgb(255, 159, 64)',
                                'rgb(199, 199, 199)',
                                'rgb(83, 102, 255)',
                                'rgb(40, 159, 64)',
                                'rgb(210, 199, 199)',
                                'rgb(78, 250, 137)',
                                'rgb(23, 45, 232)',
                                'rgb(45, 132, 45)',
                                'rgb(255, 182, 193)',
                                'rgb(170, 120, 250)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                            },
                            title: {
                                display: true,
                                text: 'Rendimiento de operaciones en base de datos'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Tiempo (ms)'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Operaciones'
                                },
                                ticks: {
                                    autoSkip: false,
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            }
                        }
                    }
                });
            </script>
        `;
        reporte.Generar();

        console.log("Script completado exitosamente!");
        console.log("Resumen de métricas:");
        Object.entries(metricas).forEach(([key, value]) => {
            console.log(`${key}: ${value}ms`);
        });

    } catch (error) {
        console.error('Error crítico:', error);
        process.exit(1);
    }
}

main();
