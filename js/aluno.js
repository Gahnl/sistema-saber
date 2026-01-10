import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

// 🔒 Proteção de rota — apenas alunos
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    // Buscar apenas notas do aluno logado
    const alunoSnap = await get(ref(db, `grades/${user.uid}`));
    const alunoGrades = alunoSnap.val();

    if (!alunoGrades) {
      tabelaNotas.innerHTML = `<tr><td colspan="2">Nenhuma nota lançada ainda.</td></tr>`;
      return;
    }

    carregarNotasEncontradas(alunoGrades);

  } catch (err) {
    console.error("Erro ao carregar notas:", err);
    tabelaNotas.innerHTML = `<tr><td colspan="2">Erro ao carregar notas.</td></tr>`;
  }
});

// Renderiza notas finais e faltas
function carregarNotasEncontradas(grades) {
  tabelaNotas.innerHTML = "";

  for (const materia in grades) {
    const materiaData = grades[materia];

    // Somente bimestres que tenham média ou faltas
    const bimestres = Object.values(materiaData).filter(b => b.media !== undefined || b.faltas !== undefined);

    const mediaFinal = calcularMediaFinal(materiaData);
    const totalFaltas = calcularTotalFaltas(materiaData);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${materia}</strong></td>
      <td style="text-align:center; padding:8px;">
        <div><strong>Média Final:</strong> <span style="color:${corMedia(mediaFinal)}; font-weight:600">${mediaFinal}</span></div>
        <div><strong>Faltas:</strong> <span style="color:${corFaltas(totalFaltas)}; font-weight:600">${totalFaltas}</span></div>
      </td>
    `;
    tabelaNotas.appendChild(tr);
  }
}

// Calcula média final
function calcularMediaFinal(materiaData) {
  let soma = 0;
  let count = 0;

  for (const b of Object.values(materiaData)) {
    if (b && b.media !== undefined && b.media !== "") {
      soma += Number(b.media);
      count++;
    }
  }

  return count > 0 ? (soma / count).toFixed(1) : "-";
}

// Calcula total de faltas
function calcularTotalFaltas(materiaData) {
  let somaFaltas = 0;
  let temFaltas = false;

  for (const b of Object.values(materiaData)) {
    if (b && b.faltas !== undefined && b.faltas !== "") {
      somaFaltas += Number(b.faltas);
      temFaltas = true;
    }
  }

  return temFaltas ? somaFaltas : "-";
}

// Define cor da média
function corMedia(media) {
  if (media === "-" || isNaN(media)) return "gray";
  return media >= 6 ? "green" : "red";
}

// Define cor das faltas
function corFaltas(faltas) {
  if (faltas === "-" || isNaN(faltas)) return "gray";
  if (faltas == 0) return "green";
  if (faltas < 5) return "orange";
  return "red";
}

// Logout
document.getElementById("sairBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Erro ao sair:", err);
  }
});
