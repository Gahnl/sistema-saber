import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA — SOMENTE ALUNO
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const snap = await get(ref(db, "users/" + user.uid));
    const u = snap.val();

    if (!u || u.role !== "student") {
      alert("Acesso negado");
      window.location.href = "index.html";
      return;
    }

    // ✅ Usuário é aluno → iniciar página normalmente
    carregarNotas(u.uid);

  } catch (err) {
    console.error("Erro ao verificar aluno:", err);
    window.location.href = "index.html";
  }
});

// ------------------------------------------------------------------
// FUNÇÃO PRINCIPAL — CARREGA NOTAS
// ------------------------------------------------------------------
async function carregarNotas(uid) {
  const gradesSnap = await get(ref(db, "grades/" + uid));
  const grades = gradesSnap.val();

  tabelaNotas.innerHTML = "";

  if (!grades) {
    tabelaNotas.innerHTML = `<tr><td colspan="6">Nenhuma nota lançada ainda.</td></tr>`;
    return;
  }

  for (const materia in grades) {
    const materiaData = grades[materia];

    // pegar os 4 bimestres
    const bimestres = [1, 2, 3, 4].map(b => materiaData[b] || {});

    // calcular média final
    const mediaFinal = calcularMediaFinal(materiaData);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${materia}</strong></td>
      ${bimestres.map(b => gerarCelula(b)).join("")}
      <td style="text-align:center; font-weight:700;">${mediaFinal}</td>
    `;
    tabelaNotas.appendChild(tr);
  }
}

// ------------------------------------------------------------------
// CALCULA MÉDIA FINAL
// ------------------------------------------------------------------
function calcularMediaFinal(m) {
  let soma = 0;
  let count = 0;

  for (let b = 1; b <= 4; b++) {
    if (m[b] && m[b].media !== undefined) {
      soma += Number(m[b].media);
      count++;
    }
  }

  return count > 0 ? (soma / count).toFixed(1) : "-";
}

// ------------------------------------------------------------------
// GERAR CÉLULA DE MÉDIA E FALTAS
// ------------------------------------------------------------------
function gerarCelula(b) {
  const media = b.media ?? "-";
  const faltas = b.faltas ?? "-";

  // cores
  let corMedia = "gray";
  if (media !== "-") {
    corMedia = media >= 6 ? "green" : "red";
  }

  let corFaltas = "gray";
  if (faltas !== "-") {
    if (faltas == 0) corFaltas = "green";
    else if (faltas < 5) corFaltas = "orange";
    else corFaltas = "red";
  }

  return `
    <td style="text-align:center; padding:8px;">
      <div><strong>Média:</strong> <span style="color:${corMedia}; font-weight:600">${media}</span></div>
      <div><strong>Faltas:</strong> <span style="color:${corFaltas}; font-weight:600">${faltas}</span></div>
    </td>
  `;
}

// ------------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------------
document.getElementById("sairBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
