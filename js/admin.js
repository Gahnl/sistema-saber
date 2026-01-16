import { auth, db, firebaseConfig } from "/js/firebase.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// Importações extras para a solução de cadastro isolado
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "admin") {
            window.location.href = "index.html";
        }
    } catch (err) { 
        window.location.href = "index.html"; 
    }
});

// ------------------------------------------------------------------
// 🛠️ FUNÇÃO MÁGICA: CADASTRAR SEM DESLOGAR O ADMIN
// ------------------------------------------------------------------
async function criarUsuarioNoSecondaryApp(email, senha, dadosPublicos) {
    // Cria uma instância temporária para não afetar o login atual
    const tempApp = initializeApp(firebaseConfig, "TempRegistration");
    const tempAuth = getAuth(tempApp);

    try {
        const uc = await createUserWithEmailAndPassword(tempAuth, email, senha);
        // Salva no Database principal usando o 'db' do admin
        await set(ref(db, "users/" + uc.user.uid), dadosPublicos);
        
        // Desloga e limpa a instância temporária
        await signOut(tempAuth);
        await deleteApp(tempApp);
        return true;
    } catch (error) {
        await deleteApp(tempApp);
        throw error;
    }
}

// ------------------------------------------------------------------
// MULTI SELECT DE TURMAS
// ------------------------------------------------------------------
const field = document.getElementById("multiSelectField");
const list = document.getElementById("multiSelectList");

if (field) {
    field.addEventListener("click", () => list.style.display = list.style.display === "block" ? "none" : "block");
    document.addEventListener("click", (e) => { 
        if (!field.contains(e.target) && !list.contains(e.target)) list.style.display = "none"; 
    });
}

window.getTurmasSelecionadas = () => [...list.querySelectorAll("input:checked")].map(chk => chk.value);

if (list) {
    list.addEventListener("change", () => {
        const sel = window.getTurmasSelecionadas();
        field.textContent = sel.length ? sel.join(", ") : "Selecione as turmas";
    });
}

// ------------------------------------------------------------------
// CADASTRAR PROFESSOR
// ------------------------------------------------------------------
document.getElementById("btnCreateProf").addEventListener("click", async () => {
    const name = document.getElementById("profName").value.trim();
    const email = document.getElementById("profEmail").value.trim();
    const senha = document.getElementById("profSenha").value.trim();
    const mat = document.getElementById("profMateria").value;
    const turmas = window.getTurmasSelecionadas();

    if (!name || !email || !senha || !mat || turmas.length === 0) return alert("Preencha tudo!");

    try {
        const dados = {
            name, email, role: "teacher", materia: mat, precisaTrocarSenha: true,
            classes: turmas.reduce((acc, t) => { acc[t] = true; return acc; }, {})
        };

        await criarUsuarioNoSecondaryApp(email, senha, dados);
        alert("Professor cadastrado com sucesso!");
        location.reload();
    } catch (e) {
        alert("Erro ao cadastrar professor: " + e.message);
    }
});

// ------------------------------------------------------------------
// CADASTRAR ALUNO
// ------------------------------------------------------------------
document.getElementById("btnCreateAluno").addEventListener("click", async () => {
    const name = document.getElementById("alunoName").value.trim();
    const email = document.getElementById("alunoEmail").value.trim();
    const senha = document.getElementById("alunoSenha").value.trim();
    const serie = document.getElementById("alunoSerie").value;

    if (!name || !email || !senha || !serie) return alert("Preencha tudo!");

    try {
        const dados = { name, email, role: "student", serie, precisaTrocarSenha: true };
        
        await criarUsuarioNoSecondaryApp(email, senha, dados);
        alert("Aluno cadastrado com sucesso!");
        location.reload();
    } catch (e) {
        alert("Erro ao cadastrar aluno: " + e.message);
    }
});

// ------------------------------------------------------------------
// VISUALIZAR BOLETIM E PDF (Mantidos conforme seu original)
// ------------------------------------------------------------------
let dadosGlobaisBoletim = [];
let alunoSelecionadoNome = "";

document.getElementById("btnVisualizarBoletim").addEventListener("click", async () => {
    const nome = document.getElementById("filtroAluno").value.trim();
    const serie = document.getElementById("filtroSerie").value;
    const areaPreview = document.getElementById("areaPreview");
    const corpo = document.getElementById("tabelaCorpoPreview");

    if (!nome || !serie) return alert("Selecione o Aluno e a Série!");

    try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val();
        let alunoUID = Object.keys(users).find(uid => users[uid].name === nome);

        if (!alunoUID) return alert("Aluno não encontrado!");

        const gradesSnap = await get(ref(db, `grades/${alunoUID}`));
        const notas = gradesSnap.val() || {};
        const materias = ["Matemática", "Português", "Arte", "História", "Geografia", "Informática", "Inglês", "Ciências", "Educação Física"];
        
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
                if(dado) {
                    somaMedias += parseFloat(dado.media || 0);
                    totalFaltas += parseInt(dado.faltas || 0);
                    bimsComNota++;
                }
            }
            const mediaFinal = bimsComNota > 0 ? (somaMedias / bimsComNota).toFixed(1) : "-";
            const corMedia = (mediaFinal !== "-" && parseFloat(mediaFinal) < 6) ? "red" : "blue";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="text-align:left; padding:10px;"><b>${mat}</b></td>
                <td>${nBims[0]}</td><td>${nBims[1]}</td><td>${nBims[2]}</td><td>${nBims[3]}</td>
                <td style="color:${corMedia}; font-weight:bold;">${mediaFinal}</td>
                <td>${totalFaltas}</td>
            `;
            corpo.appendChild(tr);
            dadosGlobaisBoletim.push([mat, ...nBims, mediaFinal, totalFaltas]);
        });

        areaPreview.style.display = "block";
        areaPreview.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { alert("Erro ao carregar prévia: " + err.message); }
});

document.getElementById("btnBaixarPDFConfirmado").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const serie = document.getElementById("filtroSerie").value;

    doc.setFontSize(18); doc.text("COLÉGIO SABER", 105, 15, { align: "center" });
    doc.setFontSize(12); doc.text(`BOLETIM ANUAL - ${alunoSelecionadoNome} (${serie})`, 105, 25, { align: "center" });

    doc.autoTable({
        startY: 35,
        head: [['Matéria', '1ºB', '2ºB', '3ºB', '4ºB', 'Média', 'Faltas']],
        body: dadosGlobaisBoletim,
        theme: 'grid',
        headStyles: { fillColor: [50, 6, 109] },
        styles: { halign: 'center' },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
                const valor = parseFloat(data.cell.raw);
                doc.setTextColor(valor < 6 ? [255, 0, 0] : [0, 0, 255]);
            }
        }
    });
    doc.save(`Boletim_${alunoSelecionadoNome}.pdf`);
});

document.getElementById("btnFecharPreview").addEventListener("click", () => {
    document.getElementById("areaPreview").style.display = "none";
});

// ------------------------------------------------------------------
// CARREGAR LISTAS E NAVEGAÇÃO
// ------------------------------------------------------------------
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
carregarAlunosDatalist();

document.getElementById("btnGerarLista").addEventListener("click", () => {
    const m = document.getElementById("filtroMateria").value;
    const s = document.getElementById("filtroSerie").value;
    const b = document.getElementById("filtroBimestre").value;
    if (!m || !s || !b) return alert("Filtros incompletos!");
    localStorage.setItem("filtroMateria", m); 
    localStorage.setItem("filtroSerie", s); 
    localStorage.setItem("filtroBimestre", b);
    window.location.href = "lista.html";
});

document.getElementById("btnVerUsuarios").addEventListener("click", () => window.location.href = "usuarios.html");