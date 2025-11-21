import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const snap = await get(ref(db, "users/" + user.uid));
  const u = snap.val();

  if (!u || u.role !== "student") {
    alert("Acesso negado");
    window.location.href = "index.html";
    return;
  }

  const gradesSnap = await get(ref(db, "grades/" + user.uid));
  const grades = gradesSnap.val();

  tabelaNotas.innerHTML = "";

  if (!grades) {
    tabelaNotas.innerHTML = `<tr><td colspan="6">Nenhuma nota lançada ainda.</td></tr>`;
    return;
  }

  for (const materia in grades) {
    const materiaData = grades[materia];

    // pegar o bimestre
    const bimestres = [1, 2, 3, 4].map((b) => materiaData[b] || {});

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${materia}</strong></td>
      ${bimestres.map(b => gerarCelula(b)).join("")}
    `;
    tabelaNotas.appendChild(tr);
  }
});

// 🔹 Exibir apenas MÉDIA e FALTAS
function gerarCelula(b) {
  const media = b.media ?? "-";
  const faltas = b.faltas ?? "-";

  // cores
  let corMedia = "gray";
  if (media !== "-") {
    if (media >= 6) corMedia = "green";
    else corMedia = "red";
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

// botão sair
document.getElementById("sairBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
