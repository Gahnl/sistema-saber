import { auth, db, firebaseConfig } from "/js/firebase.js";
import { ref, set, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "admin") {
            window.location.href = "index.html";
        } else {
            carregarListasUsuarios();
            carregarAlunosDatalist();
        }
    } catch (err) { window.location.href = "index.html"; }
});

// ------------------------------------------------------------------
// 📋 GERENCIAMENTO DE EXIBIÇÃO (TOGGLES)
// ------------------------------------------------------------------
function setupToggles() {
    const btnProf = document.getElementById("btnToggleProf");
    const btnAlu = document.getElementById("btnToggleAlunos");
    const contProf = document.getElementById("containerProfessores");
    const contAlu = document.getElementById("containerAlunos");

    btnProf?.addEventListener("click", () => {
        const isHidden = contProf.style.display === "none";
        contProf.style.display = isHidden ? "block" : "none";
        contAlu.style.display = "none";
        btnProf.textContent = isHidden ? "📁 Fechar Professores" : "📂 Ver Professores";
    });

    btnAlu?.addEventListener("click", () => {
        const isHidden = contAlu.style.display === "none";
        contAlu.style.display = isHidden ? "block" : "none";
        contProf.style.display = "none";
        btnAlu.textContent = isHidden ? "📁 Fechar Alunos" : "📂 Ver Alunos";
    });
}
setupToggles();

// ------------------------------------------------------------------
// 🚀 FUNÇÃO PRINCIPAL: GERAR LISTA DA TURMA NA TELA
// ------------------------------------------------------------------
document.getElementById("btnGerarLista")?.addEventListener("click", async () => {
    const serieSelecionada = document.getElementById("filtroSerie").value;
    const container = document.getElementById("containerListaTurma");
    const corpoTabela = document.getElementById("corpoListaTurma");
    const titulo = document.getElementById("tituloListaTurma");

    if (!serieSelecionada) {
        alert("Por favor, selecione uma série para gerar a lista!");
        return;
    }

    corpoTabela.innerHTML = "<tr><td colspan='2'>Buscando alunos...</td></tr>";
    container.style.display = "block";
    titulo.innerText = `Lista de Alunos - ${serieSelecionada}`;

    try {
        const snapshot = await get(ref(db, "users"));
        if (snapshot.exists()) {
            const usuarios = snapshot.val();
            let htmlContent = "";
            let cont = 0;

            for (let id in usuarios) {
                const u = usuarios[id];
                if (u.role === "student" && u.serie === serieSelecionada) {
                    htmlContent += `<tr><td>${u.name}</td><td>${u.email}</td></tr>`;
                    cont++;
                }
            }
            corpoTabela.innerHTML = cont > 0 ? htmlContent : "<tr><td colspan='2'>Nenhum aluno cadastrado nesta série.</td></tr>";
        }
    } catch (error) {
        alert("Erro ao carregar lista: " + error.message);
    }
});

document.getElementById("btnFecharListaTurma")?.addEventListener("click", () => {
    document.getElementById("containerListaTurma").style.display = "none";
});

// ------------------------------------------------------------------
// 📋 LISTAR USUÁRIOS DO FIREBASE (ADMINISTRAÇÃO)
// ------------------------------------------------------------------
function carregarListasUsuarios() {
    const listaProf = document.getElementById("listaProfessores");
    const listaAlu = document.getElementById("listaAlunosCadastrados");

    onValue(ref(db, "users"), (snapshot) => {
        if (!snapshot.exists()) return;
        const usuarios = snapshot.val();
        listaProf.innerHTML = "";
        listaAlu.innerHTML = "";

        for (let uid in usuarios) {
            const user = usuarios[uid];
            const tr = document.createElement("tr");

            if (user.role === "teacher") {
                const mat = user.subjects ? Object.keys(user.subjects).join(", ") : "-";
                const tur = user.classes ? Object.keys(user.classes).join(", ") : "-";
                tr.innerHTML = `<td>${user.name}</td><td>${user.email}</td><td>${mat} / ${tur}</td>
                                <td><button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button></td>`;
                listaProf.appendChild(tr);
            } else if (user.role === "student") {
                tr.innerHTML = `<td>${user.name}</td><td>${user.email}</td><td>${user.serie || "-"}</td>
                                <td><button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button></td>`;
                listaAlu.appendChild(tr);
            }
        }
    });
}

window.removerUser = async (uid) => {
    if (confirm("Deseja realmente excluir este usuário?")) {
        try { await remove(ref(db, "users/" + uid)); alert("Removido!"); } 
        catch (e) { alert("Erro: " + e.message); }
    }
};

// ------------------------------------------------------------------
// 🛠️ LÓGICA DE CADASTRO
// ------------------------------------------------------------------
async function criarUsuarioNoSecondaryApp(email, senha, dadosPublicos) {
    const appName = "TempRegistration_" + Date.now();
    const tempApp = initializeApp(firebaseConfig, appName);
    const tempAuth = getAuth(tempApp);
    try {
        const uc = await createUserWithEmailAndPassword(tempAuth, email, senha);
        await set(ref(db, "users/" + uc.user.uid), dadosPublicos);
        await signOut(tempAuth);
        await deleteApp(tempApp);
        return true;
    } catch (error) {
        await deleteApp(tempApp);
        throw error;
    }
}

document.getElementById("btnCreateProf")?.addEventListener("click", async () => {
    const name = document.getElementById("profName").value.trim();
    const email = document.getElementById("profEmail").value.trim();
    const senha = document.getElementById("profSenha").value.trim();
    const materias = window.getMateriasSelecionadas();
    const turmas = window.getTurmasSelecionadas();

    if (!name || !email || !senha || materias.length === 0 || turmas.length === 0) return alert("Preencha todos os campos do professor!");

    try {
        const dados = {
            name, email, role: "teacher", precisaTrocarSenha: true,
            subjects: materias.reduce((acc, m) => { acc[m] = true; return acc; }, {}),
            classes: turmas.reduce((acc, t) => { acc[t] = true; return acc; }, {})
        };
        await criarUsuarioNoSecondaryApp(email, senha, dados);
        alert("Professor cadastrado com sucesso!");
        location.reload();
    } catch (e) { alert("Erro: " + e.message); }
});

document.getElementById("btnCreateAluno")?.addEventListener("click", async () => {
    const name = document.getElementById("alunoName").value.trim();
    const email = document.getElementById("alunoEmail").value.trim();
    const senha = document.getElementById("alunoSenha").value.trim();
    const serie = document.getElementById("alunoSerie").value;
    if (!name || !email || !senha || !serie) return alert("Preencha todos os campos do aluno!");
    try {
        await criarUsuarioNoSecondaryApp(email, senha, { name, email, role: "student", serie, precisaTrocarSenha: true });
        alert("Aluno cadastrado com sucesso!");
        location.reload();
    } catch (e) { alert("Erro: " + e.message); }
});

// ------------------------------------------------------------------
// MULTISELECT E BUSCA
// ------------------------------------------------------------------
function setupMultiSelect(fieldId, listId) {
    const field = document.getElementById(fieldId);
    const list = document.getElementById(listId);
    field?.addEventListener("click", (e) => {
        e.stopPropagation();
        list.style.display = list.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (e) => { 
        if (!field?.contains(e.target) && !list?.contains(e.target)) list.style.display = "none"; 
    });
}
setupMultiSelect("multiSelectField", "multiSelectList");
setupMultiSelect("multiSelectMateriaField", "multiSelectMateriaList");

window.getTurmasSelecionadas = () => [...document.querySelectorAll("#multiSelectList input:checked")].map(chk => chk.value);
window.getMateriasSelecionadas = () => [...document.querySelectorAll("#multiSelectMateriaList input:checked")].map(chk => chk.value);

document.getElementById("multiSelectList")?.addEventListener("change", () => {
    const sel = window.getTurmasSelecionadas();
    document.getElementById("multiSelectField").textContent = sel.length ? sel.join(", ") : "Selecione as turmas";
});

document.getElementById("multiSelectMateriaList")?.addEventListener("change", () => {
    const sel = window.getMateriasSelecionadas();
    document.getElementById("multiSelectMateriaField").textContent = sel.length ? sel.join(", ") : "Selecione as matérias";
});

// Busca nas tabelas
const setupSearch = (inputId, tableBodyId) => {
    document.getElementById(inputId)?.addEventListener("keyup", (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.getElementById(tableBodyId).querySelectorAll("tr");
        rows.forEach(row => row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none");
    });
};
setupSearch("buscaProf", "listaProfessores");
setupSearch("buscaAluno", "listaAlunosCadastrados");

// ------------------------------------------------------------------
// BOLETIM E PDF
// ------------------------------------------------------------------
let dadosGlobaisBoletim = [];
let alunoSelecionadoNome = "";

document.getElementById("btnVisualizarBoletim")?.addEventListener("click", async () => {
    const nome = document.getElementById("filtroAluno").value.trim();
    const serie = document.getElementById("filtroSerie").value;
    const corpo = document.getElementById("tabelaCorpoPreview");
    if (!nome || !serie) return alert("Selecione Aluno e Série!");

    try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val();
        let alunoUID = Object.keys(users).find(uid => users[uid].name === nome);
        if (!alunoUID) return alert("Aluno não encontrado!");

        const gradesSnap = await get(ref(db, `grades/${alunoUID}`));
        const notas = gradesSnap.val() || {};
        const materias = ["Matemática", "Português", "Arte", "História", "Geografia", "Informática", "Inglês", "Ciências", "Educação Física", "Música", "Espanhol"];
        
        corpo.innerHTML = "";
        dadosGlobaisBoletim = [];
        alunoSelecionadoNome = nome;
        document.getElementById("infoAlunoPreview").innerText = `${nome} - ${serie}`;

        materias.forEach(mat => {
            let somaMedias = 0, totalFaltas = 0, bimsComNota = 0;
            let nBims = [];
            for(let b=1; b<=4; b++) {
                const dado = notas[mat] ? notas[mat][b] : null;
                const nota = dado ? (dado.media || "0") : "-";
                nBims.push(nota);
                if(dado) { somaMedias += parseFloat(dado.media); totalFaltas += parseInt(dado.faltas); bimsComNota++; }
            }
            const mediaFinal = bimsComNota > 0 ? (somaMedias / bimsComNota).toFixed(1) : "-";
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${mat}</td><td>${nBims[0]}</td><td>${nBims[1]}</td><td>${nBims[2]}</td><td>${nBims[3]}</td><td>${mediaFinal}</td><td>${totalFaltas}</td>`;
            corpo.appendChild(tr);
            dadosGlobaisBoletim.push([mat, nBims[0], nBims[1], nBims[2], nBims[3], mediaFinal, totalFaltas]);
        });
        document.getElementById("areaPreview").style.display = "block";
    } catch (e) { alert("Erro ao carregar boletim."); }
});

document.getElementById("btnBaixarPDFConfirmado")?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("BOLETIM - COLÉGIO SABER", 10, 10);
    doc.autoTable({ head: [['Matéria', '1ºB', '2ºB', '3ºB', '4ºB', 'Média', 'Faltas']], body: dadosGlobaisBoletim });
    doc.save(`Boletim_${alunoSelecionadoNome}.pdf`);
});

document.getElementById("btnFecharPreview")?.addEventListener("click", () => document.getElementById("areaPreview").style.display = "none");

async function carregarAlunosDatalist() {
    const snap = await get(ref(db, "users"));
    const dados = snap.val();
    const datalist = document.getElementById("listaAlunos");
    if (!dados || !datalist) return;
    datalist.innerHTML = "";
    for (let uid in dados) {
        if (dados[uid].role === "student") {
            const opt = document.createElement("option");
            opt.value = dados[uid].name;
            datalist.appendChild(opt);
        }
    }
}