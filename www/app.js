let pedidos = JSON.parse(localStorage.getItem('cg593_pedidos')) || [];
let gastos = JSON.parse(localStorage.getItem('cg593_gastos')) || [];
let compras = JSON.parse(localStorage.getItem('cg593_compras')) || [];
let apiKey = localStorage.getItem('cg593_apikey') || '';
let accionPendiente = null;

function hablar(texto) {
  document.getElementById('chocopaw-msg').innerHTML = '🐾 <strong>ChocoPaw:</strong> ' + texto;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-EC';
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }
}

document.querySelectorAll('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    actualizarPantalla();
  });
});

const btnMic = document.getElementById('btn-mic');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-EC';
  recognition.interimResults = false;

  btnMic.addEventListener('click', function() {
    btnMic.classList.add('listening');
    btnMic.textContent = '👂 ESCUCHANDO... HABLA AHORA';
    recognition.start();
  });

  recognition.onresult = function(event) {
    const transcript = event.results.item(0).item(0).transcript;
    procesarMensajeIA(transcript);
  };

  recognition.onerror = function() {
    hablar('No te escuché bien o falta permiso de micrófono. También puedes usar el micrófono de tu teclado abajo.');
  };

  recognition.onend = function() {
    btnMic.classList.remove('listening');
    btnMic.textContent = '🎤 HABLAR CON CHOCOPAW';
  };
} else {
  btnMic.addEventListener('click', function() {
    hablar('Toca el cuadro de texto de abajo y usa el micrófono de tu teclado para dictarme.');
  });
}

document.getElementById('btn-send').addEventListener('click', function() {
  const input = document.getElementById('manual-input');
  if (input.value.trim()) {
    procesarMensajeIA(input.value.trim());
    input.value = '';
  }
});

async function procesarMensajeIA(textoUsuario) {
  if (!apiKey) {
    hablar('Falta poner la clave gratuita de IA en el botón de engranaje ⚙️ arriba a la derecha.');
    return;
  }

  hablar('Pensando y organizando los datos...');

  const prompt = 'Eres ChocoPaw, un asistente virtual amable para la pasteleria ecuatoriana Cacao y Garra 593. ' +
    'Analiza este mensaje de la duena: "' + textoUsuario + '". ' +
    'Responde UNICAMENTE con un objeto JSON valido con esta estructura exacta: ' +
    '{"tipo": "pedido" o "gasto" o "compra" o "consulta", ' +
    '"resumen_voz": "Frase corta y amable explicando lo que entendiste para pedir confirmacion o respondiendo si es consulta", ' +
    '"datos": {"cliente": "nombre o Cliente", "producto": "descripcion del pastel o postre", "fecha": "fecha y hora de entrega", "total": 0, "abono": 0, "monto_gasto": 0, "detalle_gasto": "", "item_compra": ""}}';

  try {
    const urlGemini = 'https://googleapis.com' + apiKey.trim();
    const res = await fetch(urlGemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      const msgError = (data.error && data.error.message) ? data.error.message : 'Clave invalida o sin cuota';
      hablar('Error de Google AI: ' + msgError);
      return;
    }

    let rawText = data.candidates.at(0).content.parts.at(0).text;
    rawText = rawText.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(rawText);

    if (resultado.tipo === 'consulta') {
      hablar(resultado.resumen_voz);
      return;
    }

    accionPendiente = resultado;
    mostrarConfirmacion(resultado);
    hablar(resultado.resumen_voz + '. ¿Está todo correcto?');
  } catch (err) {
    hablar('No pude conectar (' + err.message + '). Revisa el internet del celular o vuelve a pegar la clave en ⚙️.');
  }
}

function mostrarConfirmacion(res) {
  const box = document.getElementById('confirm-box');
  const details = document.getElementById('confirm-details');
  box.classList.remove('hidden');

  if (res.tipo === 'pedido') {
    details.innerHTML =
      '<p><strong>Cliente:</strong> ' + res.datos.cliente + '</p>' +
      '<p><strong>Pedido:</strong> ' + res.datos.producto + '</p>' +
      '<p><strong>Entrega:</strong> ' + res.datos.fecha + '</p>' +
      '<p><strong>Total:</strong> $' + res.datos.total + ' | <strong>Abono:</strong> $' + res.datos.abono + '</p>';
  } else if (res.tipo === 'gasto') {
    details.innerHTML = '<p><strong>Gasto:</strong> ' + res.datos.detalle_gasto + ' — <strong>$' + res.datos.monto_gasto + '</strong></p>';
  } else if (res.tipo === 'compra') {
    details.innerHTML = '<p><strong>Anotar en lista del súper:</strong> ' + res.datos.item_compra + '</p>';
  }
}

document.getElementById('btn-yes').addEventListener('click', function() {
  if (!accionPendiente) return;
  const d = accionPendiente.datos;

  if (accionPendiente.tipo === 'pedido') {
    pedidos.unshift({
      id: Date.now(),
      cliente: d.cliente,
      producto: d.producto,
      fecha: d.fecha,
      total: Number(d.total) || 0,
      abono: Number(d.abono) || 0,
      entregado: false
    });
    localStorage.setItem('cg593_pedidos', JSON.stringify(pedidos));
  } else if (accionPendiente.tipo === 'gasto') {
    gastos.push({ detalle: d.detalle_gasto, monto: Number(d.monto_gasto) || 0 });
    localStorage.setItem('cg593_gastos', JSON.stringify(gastos));
  } else if (accionPendiente.tipo === 'compra') {
    compras.push(d.item_compra);
    localStorage.setItem('cg593_compras', JSON.stringify(compras));
  }

  document.getElementById('confirm-box').classList.add('hidden');
  accionPendiente = null;
  actualizarPantalla();
  hablar('¡Listo! Ya quedó guardado.');
});

document.getElementById('btn-no').addEventListener('click', function() {
  document.getElementById('confirm-box').classList.add('hidden');
  accionPendiente = null;
  hablar('De acuerdo, no guardé nada. Dímelo de nuevo cuando quieras.');
});

document.getElementById('btn-calcular').addEventListener('click', function() {
  const ing = parseFloat(document.getElementById('calc-ingredientes').value);
  if (isNaN(ing) || ing <= 0) return;

  const gastosFijos = ing * 0.25;
  const costoReal = ing + gastosFijos;
  const precioSugerido = costoReal * 2;

  document.getElementById('calc-resultado').innerHTML =
    '• Costo real (con gas, luz y caja): <strong>$' + costoReal.toFixed(2) + '</strong><br>' +
    '• Precio recomendado al cliente: <strong style="color:#2b9348; font-size:20px;">$' + precioSugerido.toFixed(2) + '</strong>';
  hablar('Hacerlo te cuesta ' + costoReal.toFixed(2) + ' dólares en total. Te recomiendo venderlo en ' + precioSugerido.toFixed(2) + ' dólares.');
});

document.getElementById('btn-add-compra').addEventListener('click', function() {
  const input = document.getElementById('item-compra');
  if (input.value.trim()) {
    compras.push(input.value.trim());
    localStorage.setItem('cg593_compras', JSON.stringify(compras));
    input.value = '';
    actualizarPantalla();
  }
});

function actualizarPantalla() {
  const listaPedidos = document.getElementById('lista-pedidos');
  listaPedidos.innerHTML = pedidos.length === 0 ? '<p>No hay pedidos pendientes todavía 🎂</p>' : '';

  let totalCobrado = 0;
  let totalPorCobrar = 0;

  pedidos.forEach(function(p, idx) {
    const saldo = p.total - p.abono;
    totalCobrado += p.abono;
    if (!p.entregado) totalPorCobrar += saldo;

    const msgWA = encodeURIComponent('Hola ' + p.cliente + ', te saluda Cacao & Garra 593 🐾. Te recordamos tu pedido: ' + p.producto + ' para el ' + p.fecha + '. Saldo pendiente: $' + saldo.toFixed(2) + '.');

    listaPedidos.innerHTML +=
      '<div class="pedido-card ' + (p.entregado ? 'entregado' : '') + '">' +
        '<strong>👤 ' + p.cliente + '</strong> — <span>📅 ' + p.fecha + '</span>' +
        '<p>🎂 ' + p.producto + '</p>' +
        '<p>💵 Total: $' + p.total.toFixed(2) + ' | Abonó: $' + p.abono.toFixed(2) + ' | <strong>Falta: $' + saldo.toFixed(2) + '</strong></p>' +
        '<div class="card-actions">' +
          '<a href="https://wa.me' + msgWA + '" target="_blank" class="btn-wa">📲 Avisar WhatsApp</a>' +
          '<button onclick="marcarEntregado(' + idx + ')" class="btn-done">' + (p.entregado ? '↩️ Reabrir' : '✅ Entregado') + '</button>' +
        '</div>' +
      '</div>';
  });

  const totalGastos = gastos.reduce(function(acc, g) { return acc + g.monto; }, 0);
  document.getElementById('stat-ingresos').textContent = '$' + totalCobrado.toFixed(2);
  document.getElementById('stat-pendiente').textContent = '$' + totalPorCobrar.toFixed(2);
  document.getElementById('stat-gastos').textContent = '$' + totalGastos.toFixed(2);
  document.getElementById('stat-ganancia').textContent = '$' + (totalCobrado - totalGastos).toFixed(2);

  const listaCompras = document.getElementById('lista-compras');
  listaCompras.innerHTML = '';
  compras.forEach(function(item, i) {
    listaCompras.innerHTML += '<li><span>🛒 ' + item + '</span> <button onclick="borrarCompra(' + i + ')">🗑️</button></li>';
  });
}

window.marcarEntregado = function(idx) {
  pedidos.at(idx).entregado = !pedidos.at(idx).entregado;
  if (pedidos.at(idx).entregado) pedidos.at(idx).abono = pedidos.at(idx).total;
localStorage.setItem('cg593_pedidos', JSON.stringify(pedidos));
actualizarPantalla();
};
window.borrarCompra = function(idx) {
compras.splice(idx, 1);
localStorage.setItem('cg593_compras', JSON.stringify(compras));
actualizarPantalla();
};
document.getElementById('btn-config').addEventListener('click', function() {
document.getElementById('api-key-input').value = apiKey;
document.getElementById('modal-config').classList.remove('hidden');
});
document.getElementById('btn-close-config').addEventListener('click', function() {
document.getElementById('modal-config').classList.add('hidden');
});
document.getElementById('btn-save-key').addEventListener('click', function() {
apiKey = document.getElementById('api-key-input').value.trim();
localStorage.setItem('cg593_apikey', apiKey);
document.getElementById('modal-config').classList.add('hidden');
hablar('¡Clave guardada! Ya estoy listo para ayudarte.');
});
actualizarPantalla();
