import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// 🔒 PROTEÇÃO DE ROTA
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  try {
    const snapUser = await get(ref(db, "users/" + user.uid));
    if (!snapUser.exists()) {
      window.location.href = "index.html";
      return;
    }
    const u = snapUser.val();
    if (u.role !== "teacher") {
      alert("Acesso negado");
      window.location.href = "index.html";
      return;
    }
    iniciarSistemaProfessor(u);
  } catch (err) {
    console.error("Erro de autenticação:", err);
    window.location.href = "index.html";
  }
});

function iniciarSistemaProfessor(u) {
  // ELEMENTOS
  const serieSelect = document.getElementById("serieSelect");
  const materiaSelect = document.getElementById("materiaSelect"); // Alterado para o Select
  const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
  const btnSalvarNotas = document.getElementById("btnSalvarNotas");
  const serieFaltasSelect = document.getElementById("serieFaltasSelect");
  const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
  const dataFaltaInput = document.getElementById("dataFalta");
  const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");
  const selectBimestre = document.getElementById("selectBimestre");
  const conteudoInput = document.getElementById("conteudo");
  const dataAulaInput = document.getElementById("dataAula");
  const bimestreConteudo = document.getElementById("bimestreConteudo");
  const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
  const listaConteudos = document.getElementById("listaConteudos");
  const secaoNotas = document.getElementById("secaoNotas");
  const bimestreNotas = document.getElementById("bimestreNotas");
  const mensagemNotas = document.getElementById("mensagemNotas");
  const btnGerarPDF = document.getElementById("btnGerarPDF");
  const filtroBimestrePDF = document.getElementById("filtroBimestrePDF");

  // POPULAR MATÉRIAS E TURMAS
  function inicializarFiltros() {
    // Matérias (do novo campo 'subjects' do admin)
    materiaSelect.innerHTML = '<option value="">Selecione a matéria</option>';
    if (u.subjects) {
      Object.keys(u.subjects).forEach(m => {
        materiaSelect.add(new Option(m, m));
      });
    } else if (u.materia) { // Backup para o formato antigo
      materiaSelect.add(new Option(u.materia, u.materia));
    }

    // Turmas
    serieSelect.innerHTML = '<option value="">Selecione a série</option>';
    serieFaltasSelect.innerHTML = '<option value="">Selecione a série</option>';
    if (u.classes) {
      Object.keys(u.classes).filter(k => u.classes[k]).sort().forEach(t => {
        serieSelect.add(new Option(t, t));
        serieFaltasSelect.add(new Option(t, t));
      });
    }
  }

  inicializarFiltros();

  // Ao trocar a matéria na seção de Conteúdos, recarrega a lista abaixo
  materiaSelect.addEventListener("change", carregarConteudos);

  // CONTROLE DE NOTAS
  const atualizarVisibilidadeNotas = () => {
    if (bimestreNotas.value && materiaSelect.value && serieSelect.value) {
      secaoNotas.style.display = "block";
      mensagemNotas.style.display = "none";
      carregarTabelaNotas();
    } else {
      secaoNotas.style.display = "none";
      mensagemNotas.style.display = "block";
    }
  };

  bimestreNotas.addEventListener("change", atualizarVisibilidadeNotas);
  serieSelect.addEventListener("change", atualizarVisibilidadeNotas);
  materiaSelect.addEventListener("change", atualizarVisibilidadeNotas);

  async function carregarTabelaNotas() {
    const serie = serieSelect.value;
    const bimestre = bimestreNotas.value;
    const materia = materiaSelect.value;
    if (!serie || !bimestre || !materia) return;

    const snapshot = await get(ref(db, "users"));
    const data = snapshot.val();
    corpoTabelaNotas.innerHTML = "";

    for (let uid in data) {
      const aluno = data[uid];
      if (aluno.role === "student" && aluno.serie === serie) {
        const tr = document.createElement("tr");
        tr.dataset.uid = uid;
        tr.innerHTML = `
          <td>${aluno.name}</td>
          <td><input type="number" data-campo="multidisciplinar" min="0" max="10" step="0.1"></td>
          <td><input type="number" data-campo="avaliacao" min="0" max="10" step="0.1"></td>
          <td><input type="number" data-campo="trabalho" min="0" max="10" step="0.1"></td>
          <td class="td-media">0</td>
          <td class="td-faltas">0</td>
        `;
        corpoTabelaNotas.appendChild(tr);
      }
    }
    carregarNotasExistentes();
  }

  corpoTabelaNotas.addEventListener("input", (e) => {
    if (e.target.tagName === "INPUT") {
      const tr = e.target.closest("tr");
      const m = Number(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
      const a = Number(tr.querySelector("[data-campo='avaliacao']").value) || 0;
      const t = Number(tr.querySelector("[data-campo='trabalho']").value) || 0;
      tr.querySelector(".td-media").textContent = ((m + a + t) / 3).toFixed(1);
    }
  });

  async function carregarNotasExistentes() {
    const materia = materiaSelect.value;
    const bimestre = bimestreNotas.value;
    for (let tr of corpoTabelaNotas.querySelectorAll("tr")) {
      const uid = tr.dataset.uid;
      const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
      const g = snap.val();
      if (g) {
        tr.querySelector("[data-campo='multidisciplinar']").value = g.multidisciplinar ?? "";
        tr.querySelector("[data-campo='avaliacao']").value = g.avaliacao ?? "";
        tr.querySelector("[data-campo='trabalho']").value = g.trabalho ?? "";
        tr.querySelector(".td-media").textContent = g.media ?? "0";
        tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
      }
    }
  }

  btnSalvarNotas.addEventListener("click", async () => {
    const materia = materiaSelect.value;
    const bimestre = bimestreNotas.value;
    if(!materia || !bimestre) return alert("Selecione matéria e bimestre!");

    for (let tr of corpoTabelaNotas.querySelectorAll("tr")) {
      const uid = tr.dataset.uid;
      const m = Number(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
      const a = Number(tr.querySelector("[data-campo='avaliacao']").value) || 0;
      const t = Number(tr.querySelector("[data-campo='trabalho']").value) || 0;
      const media = ((m + a + t) / 3).toFixed(1);
      const faltas = Number(tr.querySelector(".td-faltas").textContent) || 0;
      
      await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
        multidisciplinar: m, avaliacao: a, trabalho: t, media, faltas, professor: auth.currentUser.email
      });
    }
    alert("Notas de " + materia + " salvas!");
  });

  // FALTAS
  serieFaltasSelect.addEventListener("change", async () => {
    listaAlunosFaltas.innerHTML = "";
    const serie = serieFaltasSelect.value;
    if (!serie) return;
    const snap = await get(ref(db, "users"));
    const data = snap.val();
    for (let uid in data) {
      const a = data[uid];
      if (a.role === "student" && a.serie === serie) {
        listaAlunosFaltas.innerHTML += `<div><input type="checkbox" value="${uid}"> ${a.name}</div>`;
      }
    }
  });

  btnSalvarFaltas.addEventListener("click", async () => {
    const materia = materiaSelect.value;
    const dataFalta = dataFaltaInput.value;
    const bimestre = selectBimestre.value;
    if(!materia || !bimestre || !dataFalta) return alert("Selecione matéria, data e bimestre.");
    
    const selecionados = [...listaAlunosFaltas.querySelectorAll("input:checked")].map(cb => cb.value);
    for (let uid of selecionados) {
      const refGrade = ref(db, `grades/${uid}/${materia}/${bimestre}`);
      const snap = await get(refGrade);
      const atual = snap.val() || { faltas: 0 };
      await set(refGrade, { ...atual, faltas: (Number(atual.faltas) || 0) + 1, professor: auth.currentUser.email });
    }
    alert("Faltas lançadas em " + materia);
    // Limpar seleção
    listaAlunosFaltas.querySelectorAll("input:checked").forEach(cb => cb.checked = false);
  });

  // CONTEÚDOS
  async function carregarConteudos() {
    const materia = materiaSelect.value;
    if (!materia) {
        listaConteudos.innerHTML = "<li>Selecione uma matéria para ver os conteúdos.</li>";
        return;
    }
    const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
    const dados = snap.val();
    listaConteudos.innerHTML = "";
    if (!dados) {
      listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado para esta matéria.</li>";
      return;
    }
    for (let k in dados) {
      const c = dados[k];
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="texto-conteudo"><strong>[${c.bimestre}º Bim]</strong> ${c.data} - ${c.conteudo}</span>
        <button class="btn-excluir" style="margin-left:10px">Excluir</button>
      `;
      li.querySelector(".btn-excluir").addEventListener("click", async () => {
        if(confirm("Excluir conteúdo?")) {
          await remove(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${k}`));
          carregarConteudos();
        }
      });
      listaConteudos.appendChild(li);
    }
  }

  btnSalvarConteudo.addEventListener("click", async () => {
    const materia = materiaSelect.value;
    const data = dataAulaInput.value;
    const texto = conteudoInput.value.trim();
    const bim = bimestreConteudo.value;
    if (!materia || !data || !texto || !bim) return alert("Selecione a matéria e preencha todos os campos.");
    
    const newRef = push(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
    await set(newRef, { data, conteudo: texto, bimestre: bim });
    alert("Conteúdo salvo!");
    conteudoInput.value = "";
    carregarConteudos();
  });

  // GERAR PDF
  btnGerarPDF.addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const bimestreAlvo = filtroBimestrePDF.value;
    const materia = materiaSelect.value;

    if(!materia) return alert("Selecione uma matéria antes.");

    const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
    const dados = snap.val();
    if (!dados) return alert("Nenhum conteúdo encontrado para esta matéria.");

    const conteudosFiltrados = Object.values(dados).filter(i => i.bimestre === bimestreAlvo);
    if(conteudosFiltrados.length === 0) return alert("Nenhum conteúdo no bimestre selecionado.");

    doc.setFontSize(18);
    doc.text("COLÉGIO SABER", 105, 15, { align: "center" });
    doc.setFontSize(14);
    doc.text(`Relatório de Conteúdo - ${materia}`, 105, 25, { align: "center" });
    doc.text(`${bimestreAlvo}º Bimestre`, 105, 33, { align: "center" });
    doc.line(10, 38, 200, 38);

    let y = 50;
    conteudosFiltrados.forEach(item => {
      const dataFmt = item.data.split('-').reverse().join('/');
      doc.setFont("helvetica", "bold");
      doc.text(`Data: ${dataFmt}`, 10, y);
      doc.setFont("helvetica", "normal");
      const textLines = doc.splitTextToSize(item.conteudo, 180);
      doc.text(textLines, 10, y + 7);
      y += (textLines.length * 7) + 15;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save(`Relatorio_${materia}_${bimestreAlvo}Bim.pdf`);
  });

  // LOGOUT
  document.querySelector(".btn-logout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}