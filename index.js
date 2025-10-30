// === IMPORTACIONES ===
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const FormData = require("form-data");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-key.json");
const animeapi = require('@justalk/anime-api');
const fs = require("fs");
const DESTINOS_FILE = "./anuncios-id.json";

function leerDestinos() {
  try {
    const data = fs.readFileSync(DESTINOS_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function guardarDestino(nuevoId) {
  const destinos = leerDestinos();
  if (!destinos.includes(nuevoId)) {
    destinos.push(nuevoId);
    fs.writeFileSync(DESTINOS_FILE, JSON.stringify(destinos, null, 2));
  }
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://puntos-50cef-default-rtdb.firebaseio.com"
});

const db = admin.database();

const fecha = new Date().toLocaleString("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

console.log(`
|-------------------------------------------------------------|
| █████╗ ███╗   ██╗██╗███╗   ███╗███████╗                     |
| ██╔══██╗████╗  ██║██║████╗ ████║██╔════╝                    |
| ███████║██╔██╗ ██║██║██╔████╔██║█████╗                      |
| ██╔══██║██║╚██╗██║██║██║╚██╔╝██║██╔══╝                      |
| ██║  ██║██║ ╚████║██║██║ ╚═╝ ██║███████╗                    |
| ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝     ╚═╝╚══════╝                    |
| = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = |
| 🧠 Styceht AF NEW · Asistente oficial de Anime Offis        |
| 🎨 Creado por Destiny · Anime Offis GDL México              |
| ✅ Estado: Bot activo y listo para enviar contenido         |
| 🕒 Inicio: ${fecha}                                         |
| ✨ ¡Listo para compartir anime con estilo y corazón! ✨     |
|-------------------------------------------------------------|
`);
// === CONFIGURACIÓN DEL BOT ===
const TOKEN = "8206218614:AAFefOpYqn-5ypo6BrpR1RJxH0U-x0G_VKE"; // 🔹 Reemplaza con tu token del bot
const IMGBB_API_KEY = "5b0931fc3792f2069b046ef7eed268da"; // 🔹 Reemplaza con tu key de imgbb

const bot = new TelegramBot(TOKEN, { polling: true });

// === CANAL DE REGISTRO (LOG) ===
const LOG_CHANNEL = -1003151839574; // <-- canal pedido por ti
async function logActivity(text, options = {}) {
  try {
    const seguro = escaparMarkdown(`📌 [LOG] ${text}`);
    await bot.sendMessage(LOG_CHANNEL, seguro, { parse_mode: "MarkdownV2", ...options });
  } catch (err) {
    console.error("Error enviando log:", err && err.message ? err.message : err);
  }
}
// === FUNCIONES DE ENVÍO ===
function enviarATodos(texto, opciones = {}) {
  DESTINOS.forEach(id => {
    bot.sendMessage(id, texto, opciones).catch(err => {
      console.error("Error enviando mensaje a destino", id, err && err.message);
      logActivity(`Error enviando mensaje a ${id}: ${err && err.message ? err.message : 'unknown'}`);
    });
  });

  // también registrar el envío en el canal de logs
  logActivity(`Mensaje enviado a ${DESTINOS.length} destinos.\nContenido:\n${texto}`);
}

function enviarFotoATodos(url, opciones = {}) {
  const destinos = leerDestinos();
  destinos.forEach(id => {
    bot.sendPhoto(id, url, opciones).catch(err => {
      console.error("Error enviando foto a destino", id, err && err.message);
      logActivity(escaparMarkdown(`Error enviando foto a ${id}: ${err && err.message ? err.message : 'unknown'}`));
    });
  });

  logActivity(escaparMarkdown(`Foto enviada a ${destinos.length} destinos.\nURL: ${url}`));
}

function escaparMarkdown(texto = "") {
  return texto
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/~/g, "\\~")
    .replace(/`/g, "\\`")
    .replace(/>/g, "\\>")
    .replace(/#/g, "\\#")
    .replace(/\+/g, "\\+")
    .replace(/-/g, "\\-")
    .replace(/=/g, "\\=")
    .replace(/\|/g, "\\|")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\./g, "\\.") // ← este es el que te estaba fallando
    .replace(/!/g, "\\!");
}

// === MEMORIA TEMPORAL PARA SUBIDAS ===
const pendingUploads = {};

// === COMANDO /noticia ===
bot.onText(/\/noticia (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split("|");

  const noticia = {
    titulo: (parts[0] || "").trim(),
    descripcion1: (parts[1] || "").trim(),
    texto: (parts[2] || "").trim(),
    trailer: (parts[3] || "").trim(),
    fecha: new Date().toISOString(),
    autor: msg.from.first_name || "Anónimo",
    imagen1: null
  };

  const key = db.ref("noticias").push().key;
  db.ref("noticias/" + key).set(noticia);
  pendingUploads[msg.from.id] = { type: "noticia", key, data: noticia };

  bot.sendMessage(chatId, "📰 Noticia guardada. Si deseas añadir imagen, envíala ahora.");

  // LOG
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) creó noticia. Key: ${key}. Título: ${noticia.titulo}`);
});

// === COMANDO /pelicula ===
bot.onText(/\/pelicula (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split("|");

  const pelicula = {
    titulo: (parts[0] || "").trim(),
    descripcion: (parts[1] || "").trim(),
    fecha: new Date().toISOString(),
    trailer: (parts[2] || "").trim(),
    imagen: null
  };

  const key = db.ref("peliculas").push().key;
  db.ref("peliculas/" + key).set(pelicula);
  pendingUploads[msg.from.id] = { type: "pelicula", key, data: pelicula };

  bot.sendMessage(chatId, "🎬 Película guardada. Si deseas añadir imagen, envíala ahora.");

  // LOG
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) creó película. Key: ${key}. Título: ${pelicula.titulo}`);
});

// === COMANDO /manga ===
bot.onText(/\/manga (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split("|");

  const manga = {
    titulo: (parts[0] || "").trim(),
    descripcion: (parts[1] || "").trim(),
    trailer: (parts[2] || "").trim(),
    fecha: new Date().toISOString(),
    autor: msg.from.first_name || "Anónimo",
    imagen: null,
    tipo: "manga"
  };

  const key = db.ref("mangas").push().key;
  db.ref("mangas/" + key).set(manga);
  pendingUploads[msg.from.id] = { type: "manga", key, data: manga };
    
 bot.sendMessage(chatId, "📚 Manga guardado. Si deseas añadir imagen, envíala ahora.");

  // LOG
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) creó manga. Key: ${key}. Título: ${manga.titulo}`);
});

// === COMANDO /animeoffis ===
bot.onText(/\/animeoffis (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split("|");

  const noticia = {
    titulo: (parts[0] || "").trim(),
    descripcion: (parts[1] || "").trim(),
    texto: (parts[2] || "").trim(),
    trailer: (parts[3] || "").trim(),
    fecha: new Date().toISOString(),
    autor: msg.from.first_name || "Anónimo",
    imagen1: null,
    categoria: "animeoffis"
  };

  const key = db.ref("noticiasaf").push().key;
  db.ref("noticiasaf/" + key).set(noticia);
  pendingUploads[msg.from.id] = { type: "animeoffis", key, data: noticia };

  bot.sendMessage(chatId, "🖼️ Noticia de Anime Offis guardada. Envía ahora la imagen para publicarla con el texto.");

  // LOG
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) creó animeoffis. Key: ${key}. Título: ${noticia.titulo}`);
});

// === COMANDO /jdnews ===
bot.onText(/\/jdnew (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const parts = match[1].split("|");

  const noticia = {
    titulo: (parts[0] || "").trim(),
    descripcion: (parts[1] || "").trim(),
    texto: (parts[2] || "").trim(),
    trailer: (parts[3] || "").trim(),
    fecha: new Date().toISOString(),
    autor: "Dylan sempai",
    imagen1: null,
    categoria: "jdnew"
  };

  const key = db.ref("jdbew").push().key;
  db.ref("jdnew/" + key).set(noticia);
  pendingUploads[msg.from.id] = { type: "jdnew", key, data: noticia };

  bot.sendMessage(chatId, "🖼️ Noticia de JD News guardada. Envía ahora la imagen para publicarla con el texto.");

  // LOG
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) creó jdnew. Key: ${key}. Título: ${noticia.titulo}`);
});

// === COMANDO /subirimagen ===
bot.onText(/\/imgbb/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type !== "private") {
    bot.sendMessage(chatId, "⚠️ Este comando solo funciona en chats privados.");
    return;
  }
  pendingUploads[msg.from.id] = { type: "archivoImagen" };
  bot.sendMessage(chatId, "📁 Envía ahora tu imagen como archivo (.jpg, .png, etc).");

  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) inició /imgbb para subir imagen como archivo.`);
});

bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const mime = msg.document.mime_type;

  if (msg.chat.type !== "private") return;
  if (!pendingUploads[msg.from.id] || pendingUploads[msg.from.id].type !== "archivoImagen") return;
  if (!mime.startsWith("image/")) {
    bot.sendMessage(chatId, "❌ El archivo no es una imagen válida.");
    logActivity(`Usuario ${msg.from.id} envió document no imagen (mime: ${mime}).`);
    return;
  }

  try {
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const form = new FormData();
    form.append("image", Buffer.from(response.data).toString("base64"));

    const upload = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
      headers: form.getHeaders()
    });
    const imageUrl = upload.data.data.url;

    delete pendingUploads[msg.from.id];
    bot.sendMessage(chatId, `✅ Imagen subida con éxito:\n${imageUrl}`);

    logActivity(`Usuario ${msg.from.id} subió imagen (document). URL: ${imageUrl}`);
  } catch (err) {
    bot.sendMessage(chatId, "❌ Error subiendo imagen: " + err.message);
    logActivity(`Error subiendo imagen (document) por usuario ${msg.from.id}: ${err.message}`);
  }
});

// === SUBIDA DE IMÁGENES ===
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    const file = await bot.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const form = new FormData();
    form.append("image", Buffer.from(response.data).toString("base64"));

    const upload = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
      headers: form.getHeaders()
    });
    const imageUrl = upload.data.data.url;

    if (pendingUploads[msg.from.id]) {
      const { type, key, data } = pendingUploads[msg.from.id];

      if (type === "noticia") {
        await db.ref("noticias/" + key).update({ imagen1: imageUrl });
        enviarFotoATodos(imageUrl, {
          caption: `📰 *${escaparMarkdown(data.titulo)}*\n${escaparMarkdown(data.descripcion)}\n\n${escaparMarkdown(data.texto)}\n\n🔗 Trailer: ${escaparMarkdown(data.trailer || "No disponible")}\n\n📌 Leer más en ${escaparMarkdown("new.animeoffis.com")}`,
          parse_mode: "MarkdownV2"
        });
      } else if (type === "pelicula") {
        await db.ref("peliculas/" + key).update({ imagen: imageUrl });
        enviarFotoATodos(imageUrl, {
          caption: `📰 *${escaparMarkdown(data.titulo)}*\n${escaparMarkdown(data.descripcion)}\n\n${escaparMarkdown(data.texto)}\n\n🔗 Trailer: ${escaparMarkdown(data.trailer || "No disponible")}\n\n📌 Leer más en ${escaparMarkdown("new.animeoffis.com")}`,
          parse_mode: "MarkdownV2"
        });
      } else if (type === "manga") {
        await db.ref("mangas/" + key).update({ imagen: imageUrl });
        enviarFotoATodos(imageUrl, {
          caption: `📰 *${escaparMarkdown(data.titulo)}*\n${escaparMarkdown(data.descripcion)}\n\n${escaparMarkdown(data.texto)}\n\n🔗 Trailer: ${escaparMarkdown(data.trailer || "No disponible")}\n\n📌 Leer más en ${escaparMarkdown("new.animeoffis.com")}`,
          parse_mode: "MarkdownV2"
        });
      } else if (type === "animeoffis") {
        await db.ref("noticiasaf/" + key).update({ imagen: imageUrl });
        enviarFotoATodos(imageUrl, {
          caption: `📰 *${escaparMarkdown(data.titulo)}*\n${escaparMarkdown(data.descripcion)}\n\n${escaparMarkdown(data.texto)}\n\n🔗 Trailer: ${escaparMarkdown(data.trailer || "No disponible")}\n\n📌 Leer más en ${escaparMarkdown("new.animeoffis.com")}`,
          parse_mode: "MarkdownV2"
        });
      } else if (type === "jdnews") {
        await db.ref("jdnew/" + key).update({ imagen: imageUrl });
        enviarFotoATodos(imageUrl, {
          caption: `📰 *${escaparMarkdown(data.titulo)}*\n${escaparMarkdown(data.descripcion)}\n\n${escaparMarkdown(data.texto)}\n\n🔗 Trailer: ${escaparMarkdown(data.trailer || "No disponible")}\n\n📌 Leer más en ${escaparMarkdown("new.animeoffis.com/JDnew-sempai")}`,
          parse_mode: "MarkdownV2"
        });
      } else if (type === "subidaDirecta") {
        delete pendingUploads[msg.from.id];
        bot.sendMessage(chatId, `✅ Imagen subida con éxito:\n${imageUrl}`);
      }

      delete pendingUploads[msg.from.id];
      bot.sendMessage(chatId, "✅ Imagen añadida correctamente.");

      // LOG: subida de foto y asociación con pendiente
      logActivity(`Usuario ${msg.from.id} subió foto. Asociada a tipo: ${type}, key: ${key || 'N/A'}. URL: ${imageUrl}`);
    } else {
      bot.sendMessage(chatId, "⚠️ No hay publicación pendiente. Usa /noticia, /pelicula o /manga primero.");
      logActivity(`Usuario ${msg.from.id} envió foto pero no tenía publicación pendiente.`);
    }
  } catch (err) {
    bot.sendMessage(chatId, "❌ Error subiendo imagen: " + err.message);
    logActivity(`Error procesando foto de ${msg.from.id}: ${err && err.message ? err.message : 'unknown'}`);
  }
});

bot.onText(/\/animedow (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const [name, ep] = match[1].split("|").map(s => s.trim());
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, "❗ Este comando solo funciona en privado.");
  }
  try {
    const results = await animeapi.download(name, parseInt(ep));
    const response = results.map(r => `📥 ${r.source}: ${r.link}`).join('\n');
    bot.sendMessage(chatId, response || "No se encontraron descargas.");
    logActivity(`Usuario ${msg.from.id} solicitó animedow: ${name} ep ${ep}. Resultados: ${results.length}`);
  } catch (err) {
    bot.sendMessage(chatId, "❌ Error al buscar la descarga.");
    logActivity(`Error animedow por ${msg.from.id} para ${name} ep ${ep}: ${err.message}`);
  }
});

bot.onText(/\/animestream (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const [name, ep] = match[1].split("|").map(s => s.trim());
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, "❗ Este comando solo funciona en privado.");
  }

  try {
    const results = await animeapi.stream(name, parseInt(ep));
    const response = results.map(r => `▶️ ${r.source}: ${r.link}`).join('\n');
    bot.sendMessage(chatId, response || "No se encontraron streams.");
    logActivity(`Usuario ${msg.from.id} solicitó animestream: ${name} ep ${ep}. Resultados: ${results.length}`);
  } catch (err) {
    bot.sendMessage(chatId, "❌ Error al buscar el episodio.");
    logActivity(`Error animestream por ${msg.from.id} para ${name} ep ${ep}: ${err.message}`);
  }
});
bot.onText(/\/agregarid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (msg.chat.type !== "private") {
    return bot.sendMessage(chatId, "❗ Este comando solo funciona en privado.");
  }

  const nuevoId = parseInt(match[1].trim());
  if (isNaN(nuevoId)) {
    return bot.sendMessage(chatId, "❌ ID inválido. Usa: /agregarid -1001234567890");
  }

  try {
    // Intentar enviar un mensaje de prueba
    await bot.sendMessage(nuevoId, "🛠 Verificando acceso…");

    // Obtener nombre del grupo/canal si es posible
    const chatInfo = await bot.getChat(nuevoId);
    const nombre = chatInfo.title || `ID ${nuevoId}`;

    guardarDestino(nuevoId);

    bot.sendMessage(chatId, `✅ Grupo agregado para *Noticias Offis New* con Styceht:\n📡 *${escaparMarkdown(nombre)}*`, {
      parse_mode: "MarkdownV2"
    });

    logActivity(`Grupo agregado: ${nombre} (${nuevoId}) por ${msg.from.id}`);
  } catch (err) {
    bot.sendMessage(chatId, "❌ No pude acceder al grupo/canal. ¿Estoy agregado como administrador?");
    logActivity(escaparMarkdown(`Error al verificar acceso a ${nuevoId} por ${msg.from.id}: ${err.message}`));
  }
});
// === MENSAJE DE INICIO ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "👋 ¡Hola! Soy styceth la asistente de Anime Offis.\nUsa:\n\n📰 /noticia titulo | descripcion | texto | trailer\n🎬 /pelicula titulo | descripcion | trailer\n📚 /manga titulo | descripcion | trailer");
  logActivity(`Usuario ${msg.from.username || msg.from.first_name || msg.from.id} (${msg.from.id}) usó /start en chat ${msg.chat.id}`);
});
