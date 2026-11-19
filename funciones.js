
const formulario = document.getElementById("formularioVehiculo");
const tabla = document.getElementById("tablaMovimientos");
const buscador = document.getElementById("buscar");

let movimientos = [];

// FORMATO DE FECHA
function fechaHora(fecha) {
    if (!fecha) return "Pendiente";

    return new Date(fecha).toLocaleString("es-MX");
}

// CONSULTAR MOVIMIENTOS EN POSTGRESQL
async function cargarMovimientos() {
    try {
        const respuesta = await fetch("/api/movimientos");

        if (!respuesta.ok) {
            throw new Error("No se pudieron consultar los movimientos");
        }

        movimientos = await respuesta.json();

        actualizar();

    } catch (error) {
        console.error(error);
        alert("Error al cargar los movimientos");
    }
}

// MOSTRAR TABLA Y ESTADISTICAS
function actualizar() {
    const filtro = buscador.value.toLowerCase();

    const encontrados = movimientos.filter(m => {
        const nombre = `${m.nombre} ${m.apPat} ${m.apMat || ""}`;

        return `${nombre} ${m.identificador} ${m.tipo}`
            .toLowerCase()
            .includes(filtro);
    });

    tabla.replaceChildren();

    if (encontrados.length === 0) {
        const fila = tabla.insertRow();
        const celda = fila.insertCell();

        celda.colSpan = 7;
        celda.className = "vacio";
        celda.textContent = "No hay movimientos registrados.";
    }

    encontrados.forEach(m => {
        const fila = tabla.insertRow();

        const nombre = `${m.nombre} ${m.apPat} ${m.apMat || ""}`;

        [
            nombre,
            m.tipo,
            m.identificador,
            fechaHora(m.fecha_entrada),
            fechaHora(m.fecha_salida)
        ].forEach(texto => {
            fila.insertCell().textContent = texto;
        });

        const celdaEstado = fila.insertCell();

        celdaEstado.textContent = m.fecha_salida
            ? "Fuera"
            : "Dentro";

        celdaEstado.className = m.fecha_salida
            ? "estado-fuera"
            : "estado-dentro";

        const celdaAccion = fila.insertCell();

        if (!m.fecha_salida) {
            const boton = document.createElement("button");

            boton.textContent = "Registrar salida";
            boton.className = "btn-salida";

            boton.addEventListener("click", () => {
                registrarSalida(m.id_movimiento);
            });

            celdaAccion.appendChild(boton);

        } else {
            celdaAccion.textContent = "Completado";
        }
    });

    // ESTADISTICAS
    document.getElementById("totalDentro").textContent =
        movimientos.filter(m => !m.fecha_salida).length;

    document.getElementById("totalEntradas").textContent =
        movimientos.length;

    document.getElementById("totalSalidas").textContent =
        movimientos.filter(m => m.fecha_salida).length;
}

// REGISTRAR ENTRADA
formulario.addEventListener("submit", async event => {
    event.preventDefault();

    const datos = {
        nombre: document.getElementById("nombre").value.trim(),
        apPaterno: document.getElementById("apPaterno").value.trim(),
        apMaterno: document.getElementById("apMaterno").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        tipo: document.getElementById("tipoVehiculo").value,
        identificador: document.getElementById("identificador")
            .value.trim().toUpperCase()
    };

    try {
        const respuesta = await fetch("/api/vehiculos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            alert(resultado.error);
            return;
        }

        alert(resultado.mensaje);

        formulario.reset();

        await cargarMovimientos();

    } catch (error) {
        console.error(error);
        alert("No se pudo conectar con el servidor");
    }
});

// REGISTRAR SALIDA
async function registrarSalida(id) {
    try {
        const respuesta = await fetch(
            `/api/movimientos/${id}/salida`,
            { method: "PUT" }
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            alert(resultado.error);
            return;
        }

        alert(resultado.mensaje);

        await cargarMovimientos();

    } catch (error) {
        console.error(error);
        alert("Error al registrar la salida");
    }
}

// BUSCADOR
buscador.addEventListener("input", actualizar);

// CARGAR DATOS AL ABRIR LA PAGINA
cargarMovimientos();
