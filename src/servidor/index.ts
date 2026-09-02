/**
 * index.ts — servidor SGMC real, sin framework, con las tablas del Sistema
 * en CSV bajo ./data/*.csv (cada petición lee y escribe esos archivos
 * directamente: no hay caché en memoria que los pueda dejar desactualizados).
 *
 *   npm run server   →   http://127.0.0.1:4000
 */

import { createServer } from "node:http";
import { registrarRutasCartera } from "./cartera.ts";
import { registrarRutasCierres } from "./cierres.ts";
import { registrarRutasClientes } from "./clientes.ts";
import { Router } from "./comun.ts";
import { registrarRutasCreditos } from "./creditos.ts";
import { registrarRutasPagos } from "./pagos.ts";
import { registrarRutasSolicitudes } from "./solicitudes.ts";

const router = new Router();
registrarRutasClientes(router);
registrarRutasSolicitudes(router);
registrarRutasCreditos(router);
registrarRutasPagos(router);
registrarRutasCierres(router);
registrarRutasCartera(router);

const puerto = Number(process.env.PORT ?? 4000);
const servidor = createServer((req, res) => {
  void router.despachar(req, res);
});

servidor.listen(puerto, () => {
  console.log(`OK · servidor SGMC escuchando en http://127.0.0.1:${puerto} — datos en ./data/*.csv`);
});
