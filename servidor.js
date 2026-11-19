
const express = require("express");
const pool = require("./conexion");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 1. COMPROBAR CONEXION CON POSTGRESQL
// ==========================================

app.get("/api/prueba", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT current_database() AS base"
        );

        res.json({
            mensaje: "Conexion exitosa con PostgreSQL",
            base: resultado.rows[0].base
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error de conexion"
        });
    }
});

// ==========================================
// 2. REGISTRAR PERSONA Y VEHICULO
// ==========================================

app.post("/api/vehiculos", async (req, res) => {
    let client;

    try {
        client = await pool.connect();

        const {
            nombre,
            apPaterno,
            apMaterno,
            correo,
            tipo,
            identificador
        } = req.body;

        if (!nombre || !apPaterno || !correo ||
            !tipo || !identificador) {

            return res.status(400).json({
                error: "Faltan datos obligatorios"
            });
        }

        await client.query("BEGIN");

        // Comprobar si el vehiculo ya esta dentro
        const ocupado = await client.query(`
            SELECT m.id_movimiento
            FROM Movimiento m
            JOIN Vehiculo v
                ON m.id_vehiculo = v.id_vehiculo
            WHERE LOWER(v.identificador) = LOWER($1)
            AND m.fecha_salida IS NULL
        `, [identificador]);

        if (ocupado.rows.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                error: "Este vehiculo ya tiene una entrada sin salida"
            });
        }

        // Registrar persona
        const persona = await client.query(`
            INSERT INTO Datos_persona
            (nombre, apPat, apMat)
            VALUES ($1, $2, $3)
            RETURNING id_p
        `, [
            nombre,
            apPaterno,
            apMaterno || null
        ]);

        const idPersona = persona.rows[0].id_p;

        // Registrar correo
        await client.query(`
            INSERT INTO Correo
            (nombreC, id_persona)
            VALUES ($1, $2)
        `, [correo, idPersona]);

        // Registrar vehiculo
        const vehiculo = await client.query(`
            INSERT INTO Vehiculo
            (tipo, identificador, id_persona)
            VALUES ($1, $2, $3)
            RETURNING id_vehiculo
        `, [
            tipo,
            identificador.toUpperCase(),
            idPersona
        ]);

        const idVehiculo = vehiculo.rows[0].id_vehiculo;

        // Registrar entrada
        await client.query(`
            INSERT INTO Movimiento (id_vehiculo)
            VALUES ($1)
        `, [idVehiculo]);

        await client.query("COMMIT");

        res.status(201).json({
            mensaje: "Entrada registrada correctamente"
        });

    } catch (error) {

        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error(error);

        res.status(500).json({
            error: "No se pudo registrar el vehiculo"
        });

    } finally {

        if (client) {
            client.release();
        }
    }
});

// ==========================================
// 3. CONSULTAR MOVIMIENTOS
// ==========================================


app.get("/api/movimientos", async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                m.id_movimiento,
                p.nombre,
                p.appat AS "apPat",
                p.apmat AS "apMat",
                v.tipo,
                v.identificador,
                m.fecha_entrada,
                m.fecha_salida
            FROM Movimiento m
            JOIN Vehiculo v
                ON m.id_vehiculo = v.id_vehiculo
            JOIN Datos_persona p
                ON v.id_persona = p.id_p
            ORDER BY m.fecha_entrada DESC
        `);

        res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar movimientos:", error);

        res.status(500).json({
            error: "Error al consultar movimientos"
        });
    }
});

// ==========================================
// 4. REGISTRAR SALIDA
// ==========================================

app.put("/api/movimientos/:id/salida", async (req, res) => {
    try {
        const resultado = await pool.query(`
            UPDATE Movimiento
            SET fecha_salida = CURRENT_TIMESTAMP
            WHERE id_movimiento = $1
            AND fecha_salida IS NULL
            RETURNING id_movimiento
        `, [req.params.id]);

        if (resultado.rowCount === 0) {

            return res.status(404).json({
                error: "Movimiento inexistente o ya tiene salida"
            });
        }

        res.json({
            mensaje: "Salida registrada correctamente"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al registrar salida"
        });
    }
});

// ==========================================
// 5. INICIAR SERVIDOR
// ==========================================

app.listen(3000, () => {
    console.log("Servidor iniciado en http://localhost:3000");
});
