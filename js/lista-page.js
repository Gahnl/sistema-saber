// Arquivo: lista-page.js (FINAL GARANTIDO COM ADMIN LOCAL BYPASS E CORREÇÃO DE NaN)

// 1. IMPORTAÇÕES NECESSÁRIAS
import { auth, db } from "./firebase.js"; 
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js"; 

console.log("Lista-page.js carregado ✔");

const tabelaContainer = document.getElementById("tabelaNotasFaltas");
const pdfContainer = document.getElementById("pdfContainer");
const btnExportarPDF = document.getElementById("btnExportarPDF");

// -------------------------------------------------------------
// LÓGICA PRINCIPAL: VERIFICAR LOGIN E INICIAR (Com Admin Local Bypass)
// -------------------------------------------------------------

onAuthStateChanged(auth, (user) => {
  // 🔥 VERIFICAÇÃO CRÍTICA: Se não há sessão, mas o usuário veio do login local, forçamos o Admin
  if (!user) {
      // Verifica se o usuário é o Admin Local (usando a flag salva no login.js)
      const userEmail = "admin@saber.com";
      if (localStorage.getItem("lastLoginEmail") === userEmail) {
          console.warn("Sessão Firebase Auth nula, mas Admin Local detectado. Prosseguindo.");
          // Cria um objeto 'user' temporário para o sistema funcionar
          const adminUser = { uid: "admin-local", email: userEmail, role: "admin" };
          iniciarLista(adminUser);
          return;
      }
      
      console.warn("Usuário não autenticado. Redirecionando.");
      alert("Sessão expirada ou acesso negado. Faça login novamente.");
      window.location.href = "index.html";
      return;
  }
  
  // Se houver sessão, procede normalmente
  console.log("Sessão autenticada ✔");
  iniciarLista(user);
});


// ------------------------------------------------------------------
// 2. FUNÇÕES PRINCIPAIS 
// ------------------------------------------------------------------

async function iniciarLista(user) {
  if (tabelaContainer) tabelaContainer.innerHTML = `<p style='text-align:center;'>Carregando dados do usuário...</p>`;
  
  try {
    let u;
    
    // Verifica se é o admin local que criamos na função onAuthStateChanged
    if (user.uid === "admin-local") {
        u = { role: "admin" };
    } else {
        const snapUser = await get(ref(db, "users/" + user.uid));
        u = snapUser.val();
        
        // Logica de verificação de Admin para casos onde o usuário não está no Realtime DB (ex: Admin criado apenas no Auth)
        if (!u && user.email?.toLowerCase().includes("saber")) {
            u = { role: "admin" };
        }
    }


    if (!u || u.role !== "admin") {
      alert("Apenas administradores podem acessar esta página!");
      window.location.href = "index.html";
      return;
    }

    // Filtros
    const materia = localStorage.getItem("filtroMateria") || u.materia || "";
    const serie = localStorage.getItem("filtroSerie") || "";
    const bimestre = localStorage.getItem("filtroBimestre") || ""; 
    const alunoFiltro = localStorage.getItem("filtroAluno") || ""; 

    // Chamada da função de carregamento otimizada
    await carregarTabela(materia, serie, bimestre, alunoFiltro, tabelaContainer, pdfContainer);

    // Configuração da exportação para PDF
    if (btnExportarPDF) {
      btnExportarPDF.onclick = () => {
        const dataAtual = new Date().toLocaleDateString("pt-BR");
        const elemento = document.createElement("div");
        elemento.innerHTML = tabelaContainer.innerHTML;

        if (typeof html2pdf !== 'undefined') {
          html2pdf()
            .set({
              margin: 10,
              filename: `Planilha_${dataAtual.replace(/\//g, "-")}.pdf`,
              html2canvas: { scale: 2 },
              jsPDF: { orientation: "landscape", unit: "mm", format: "a4" }
            })
            .from(elemento)
            .save();
        } else {
             alert("Erro: Biblioteca html2pdf não carregada. Verifique o lista.html.");
        }
      };
    }

  } catch (err) {
    console.error("Erro em iniciarLista:", err);
    if (tabelaContainer) tabelaContainer.innerHTML = `<p style="text-align:center; color:red;">Erro ao carregar lista: ${err.message}</p>`;
  }
}

// ------------------------------------------------------------------
// 3. FUNÇÃO carregarTabela (CORRIGIDA: FIM DO NaN)
// ------------------------------------------------------------------

async function carregarTabela(materia, serie, bimestre, alunoFiltro, tabelaContainer, pdfContainer) {
  if (tabelaContainer) tabelaContainer.innerHTML = `<p style='text-align:center;'>Carregando tabela de notas...</p>`;
  if(pdfContainer) pdfContainer.style.display = "none";

  // Busca todos os usuários
  const snapUsers = await get(ref(db, "users"));
  const users = snapUsers.val();

  // 💥 OTIMIZAÇÃO: Busca TODAS as notas de TODOS os alunos de uma vez (1 chamada de rede!)
  const snapAllGrades = await get(ref(db, "grades"));
  const allGrades = snapAllGrades.val();

  if (!users) {
    if (tabelaContainer) tabelaContainer.innerHTML = `<p style='text-align:center;'>Nenhum aluno encontrado.</p>`;
    return;
  }
  
  let html = `
  <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse:collapse; text-align:center;">
    <thead style="background:#32066d;color:#f8f008;">
      <tr>
        <th>Aluno</th>
        <th>Série</th>
        <th>1º Nota</th><th>1º Faltas</th>
        <th>2º Nota</th><th>2º Faltas</th>
        <th>3º Nota</th><th>3º Faltas</th>
        <th>4º Nota</th><th>4º Faltas</th>
        <th>Total Faltas</th>
        <th>Média Final</th>
      </tr>
    </thead><tbody>
  `;

  let encontrou = false;

  for (let uid in users) {
    const aluno = users[uid];
    if (aluno.role !== "student") continue;

    // Filtros
    if (serie && aluno.serie !== serie) continue;
    if (alunoFiltro && aluno.name.toLowerCase() !== alunoFiltro.toLowerCase()) continue;

    // Acessa as notas do aluno LOCALMENTE (RÁPIDO!)
    const grades = allGrades?.[uid]?.[materia]; 
    if (!grades) continue;

    encontrou = true;

    let totalFaltas = 0;
    let somaNotas = 0;
    let qtdNotas = 0;

    html += `<tr>
      <td><strong>${aluno.name}</strong></td>
      <td>${aluno.serie}</td>
    `;

    // Processa os 4 bimestres
    for (let b = 1; b <= 4; b++) {
      const nota = grades[b]?.media ?? "-";
      const faltas = grades[b]?.faltas ?? "-";
      
      // ✅ CORREÇÃO PARA O NaN: Se faltas for "-", Number(faltas) retorna NaN, então usamos 0.
      const faltasNumericas = Number(faltas) || 0; 
      
      if (!isNaN(nota) && nota !== "-") {
        somaNotas += Number(nota);
        qtdNotas++;
      }

      totalFaltas += faltasNumericas; // SOMA APENAS O NÚMERO OU ZERO

      html += `<td>${nota}</td><td>${faltas}</td>`;
    }

    const mediaFinal = qtdNotas ? (somaNotas / qtdNotas).toFixed(1) : "-";

    html += `
      <td>${totalFaltas}</td>
      <td><strong>${mediaFinal}</strong></td>
    </tr>`;
  }

  html += `</tbody></table>`;

  tabelaContainer.innerHTML = encontrou ? html : `<p style="text-align:center;">Nenhum dado encontrado com os filtros atuais.</p>`;
  if(pdfContainer) pdfContainer.style.display = encontrou ? "block" : "none";
}