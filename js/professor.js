import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

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
            alert("Acesso negado: apenas professores podem acessar esta área.");
            window.location.href = "index.html";
            return;
        }
        iniciarSistemaProfessor(u);
    } catch (err) {
        console.error("Erro ao verificar permissões:", err);
        window.location.href = "index.html";
    }
});

function iniciarSistemaProfessor(u) {
    // ELEMENTOS DO DOM
    const serieSelect = document.getElementById("serieSelect");
    const materiaSelect = document.getElementById("materiaSelect");
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

    let idEdicaoAtual = null;

    // 🛠️ FILTROS INICIAIS
    function inicializarFiltros() {
        materiaSelect.innerHTML = '<option value="">Selecione a série primeiro</option>';
        if (u.atribuicoes) {
            Object.keys(u.atribuicoes).sort().forEach(turma => {
                serieSelect.add(new Option(turma, turma));
                serieFaltasSelect.add(new Option(turma, turma));
            });
        }
    }

    serieSelect.addEventListener("change", () => {
        const serieEscolhida = serieSelect.value;
        materiaSelect.innerHTML = '<option value="">Selecione a matéria</option>';
        if (serieEscolhida && u.atribuicoes[serieEscolhida]) {
            u.atribuicoes[serieEscolhida].forEach(m => materiaSelect.add(new Option(m, m)));
        }
        atualizarVisibilidadeNotas();
    });

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
    materiaSelect.addEventListener("change", () => {
        atualizarVisibilidadeNotas();
        carregarConteudos();
        carregarHistoricoFaltas();
    });

    // 📊 LÓGICA DE NOTAS
    
    async function carregarTabelaNotas() {
        const serie = serieSelect.value;
        if (!serie) return;
        corpoTabelaNotas.innerHTML = "<tr><td colspan='7'>Carregando alunos...</td></tr>";
        try {
            const snapshot = await get(ref(db, "users"));
            const data = snapshot.val();
            corpoTabelaNotas.innerHTML = "";
            const listaOrdenada = Object.keys(data)
                .map(uid => ({ uid, ...data[uid] }))
                .filter(aluno => aluno.role === "student" && aluno.serie === serie)
                .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            listaOrdenada.forEach(aluno => {
                const tr = document.createElement("tr");
                tr.dataset.uid = aluno.uid;
                tr.innerHTML = `
                    <td>${aluno.name}</td>
                    <td><input type="number" data-campo="p1" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="p2" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="trabalhos" min="0" max="10" step="0.1" value="0"></td>
                    <td><input type="number" data-campo="recuperacao" min="0" max="10" step="0.1" value=""></td>
                    <td class="td-media">0.0</td>
                    <td class="td-faltas">0</td>
                `;
                corpoTabelaNotas.appendChild(tr);
            });
            carregarNotasExistentes();
        } catch (err) { console.error(err); }
    }

    corpoTabelaNotas.addEventListener("input", (e) => {
        if (e.target.tagName === "INPUT") {
            const tr = e.target.closest("tr");
            const p1 = parseFloat(tr.querySelector("[data-campo='p1']").value) || 0;
            const p2 = parseFloat(tr.querySelector("[data-campo='p2']").value) || 0;
            const trab = parseFloat(tr.querySelector("[data-campo='trabalhos']").value) || 0;
            const recVal = tr.querySelector("[data-campo='recuperacao']").value;
            
            let mediaBase = (p1 + p2 + trab) / 3;
            let mediaFinal = mediaBase;

            if (recVal !== "") {
                const rec = parseFloat(recVal);
                if (rec > mediaBase) mediaFinal = rec;
            }
            tr.querySelector(".td-media").textContent = mediaFinal.toFixed(1);
        }
    });

    async function carregarNotasExistentes() {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        const linhas = corpoTabelaNotas.querySelectorAll("tr");
        for (let tr of linhas) {
            const uid = tr.dataset.uid;
            const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
            const g = snap.val();
            if (g) {
                tr.querySelector("[data-campo='p1']").value = g.p1 ?? 0;
                tr.querySelector("[data-campo='p2']").value = g.p2 ?? 0;
                tr.querySelector("[data-campo='trabalhos']").value = g.trabalhos ?? 0;
                tr.querySelector("[data-campo='recuperacao']").value = g.recuperacao ?? "";
                tr.querySelector(".td-media").textContent = g.media ?? "0.0";
                tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
            }
        }
    }

    btnSalvarNotas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        btnSalvarNotas.disabled = true;
        btnSalvarNotas.innerText = "Salvando...";
        try {
            const linhas = corpoTabelaNotas.querySelectorAll("tr");
            for (let tr of linhas) {
                const uid = tr.dataset.uid;
                const p1 = parseFloat(tr.querySelector("[data-campo='p1']").value) || 0;
                const p2 = parseFloat(tr.querySelector("[data-campo='p2']").value) || 0;
                const trab = parseFloat(tr.querySelector("[data-campo='trabalhos']").value) || 0;
                const recVal = tr.querySelector("[data-campo='recuperacao']").value;
                const media = parseFloat(tr.querySelector(".td-media").textContent) || 0;
                const faltas = parseInt(tr.querySelector(".td-faltas").textContent) || 0;

                const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
                const dadosOriginais = snap.val() || {};

                await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
                    ...dadosOriginais,
                    p1, p2, trabalhos: trab, recuperacao: recVal !== "" ? parseFloat(recVal) : "",
                    media, faltas, professor: u.email, dataPostagem: new Date().toLocaleDateString()
                });
            }
            alert("Notas salvas!");
        } catch (e) { alert("Erro ao salvar."); }
        finally { btnSalvarNotas.disabled = false; btnSalvarNotas.innerText = "Salvar Notas"; }
    });

   // 🗓️ LÓGICA DE FALTAS
serieFaltasSelect.addEventListener("change", carregarAlunosParaFaltas);
selectBimestre.addEventListener("change", carregarHistoricoFaltas);

async function carregarAlunosParaFaltas() {
    const serie = serieFaltasSelect.value;
    if (!serie) return;

    listaAlunosFaltas.innerHTML = "Carregando alunos...";

    try {
        const snap = await get(ref(db, "users"));
        const data = snap.val();

        listaAlunosFaltas.innerHTML = "";

        Object.keys(data)
            .map(uid => ({ uid, ...data[uid] }))
            .filter(a => a.role === "student" && a.serie === serie)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach(a => {
                const div = document.createElement("div");
                div.style.cssText = "display:block;margin:5px 0;border-bottom:1px solid #eee;padding-bottom:5px;";
                div.innerHTML = `
                    <label style="cursor:pointer;">
                        <input type="checkbox" value="${a.uid}">
                        <span class="nome-aluno">${a.name}</span>
                    </label>`;
                listaAlunosFaltas.appendChild(div);
            });

        carregarHistoricoFaltas();

    } catch (e) {
        console.error(e);
    }
}

async function carregarHistoricoFaltas() {
    const materia = materiaSelect.value;
    const bimestre = selectBimestre.value;
    const serie = serieFaltasSelect.value;

    let cont = document.getElementById("contHistFaltas");

    if (!cont) {
        cont = document.createElement("div");
        cont.id = "contHistFaltas";
        cont.style.cssText = "margin-top:20px;padding:15px;background:#f9f9f9;border:1px solid #ddd;border-radius:8px;";
        btnSalvarFaltas.after(cont);
    }

    if (!materia || !serie || !bimestre) {
        cont.innerHTML = "<p style='color:#666;'>Selecione Matéria, Série e Bimestre.</p>";
        return;
    }

    cont.innerHTML = "🔍 Buscando histórico...";

    try {
        const checkboxes = listaAlunosFaltas.querySelectorAll("input[type='checkbox']");
        let mapaDatas = {}; // { "2024-05-10": ["Aluno A", "Aluno B"] }

        for (let cb of checkboxes) {
            const uid = cb.value;
            const nomeAluno = cb.parentElement.querySelector(".nome-aluno").innerText;

            const snapH = await get(ref(db, `grades/${uid}/${materia}/${bimestre}/historicoFaltas`));

            if (snapH.exists()) {
                Object.values(snapH.val()).forEach(dataFalta => {
                    if (!mapaDatas[dataFalta]) mapaDatas[dataFalta] = [];
                    mapaDatas[dataFalta].push(nomeAluno);
                });
            }
        }

        const listaDatas = Object.keys(mapaDatas).sort().reverse();

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0;">🗓️ Datas com faltas:</h4>
                <button onclick="window.limparTodoHistorico()" 
                    style="background:#000; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:11px;">
                    Apagar Tudo
                </button>
            </div>
        `;

        if (listaDatas.length === 0) {
            cont.innerHTML += "<p style='color:#888;'>Nenhum registro encontrado.</p>";
            return;
        }

        const ul = document.createElement("ul");
        ul.style.cssText = "list-style:none;padding:0;";

        listaDatas.forEach(data => {
            const li = document.createElement("li");
            li.style.cssText = "background:#fff;border:1px solid #eee;margin-bottom:8px;padding:10px;border-radius:5px;position:relative;";

            const dataFormatada = data.split('-').reverse().join('/');
            const alunosQueFaltaram = mapaDatas[data].join(", ");

            li.innerHTML = `
                <div style="margin-right:100px;">
                    <span>Aula dia: <strong>${dataFormatada}</strong></span><br>
                    <small style="color:#666; display:block; margin-top:4px;">Faltaram: ${alunosQueFaltaram}</small>
                </div>
                <button onclick="window.excluirDiaFalta('${data}')" 
                    style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">
                    Excluir
                </button>
            `;

            ul.appendChild(li);
        });

        cont.appendChild(ul);

    } catch (e) {
        console.error(e);
        cont.innerHTML = "<p style='color:red;'>Erro ao carregar histórico.</p>";
    }
}

// 🗑️ EXCLUIR UM DIA ESPECÍFICO
window.excluirDiaFalta = async (dataAlvo) => {
    const materia = materiaSelect.value;
    const bimestre = selectBimestre.value;

    if (!confirm(`Excluir todas as faltas do dia ${dataAlvo.split('-').reverse().join('/')}?`))
        return;

    try {
        const checkboxes = listaAlunosFaltas.querySelectorAll("input[type='checkbox']");

        for (let cb of checkboxes) {
            const uid = cb.value;
            const refP = `grades/${uid}/${materia}/${bimestre}`;
            const snapH = await get(ref(db, `${refP}/historicoFaltas`));

            if (snapH.exists()) {
                const historico = snapH.val();
                for (let key in historico) {
                    if (historico[key] === dataAlvo) {
                        // Remove a data do histórico
                        await remove(ref(db, `${refP}/historicoFaltas/${key}`));

                        // Decrementa o contador total de faltas
                        const snapG = await get(ref(db, refP));
                        const dados = snapG.val() || {};
                        const faltasAtuais = parseInt(dados.faltas) || 0;

                        await update(ref(db, refP), {
                            faltas: Math.max(0, faltasAtuais - 1)
                        });
                    }
                }
            }
        }

        alert("Dia excluído com sucesso!");
        carregarHistoricoFaltas();

    } catch (e) {
        console.error(e);
        alert("Erro ao excluir.");
    }
};

// 💣 LIMPAR TODO O HISTÓRICO DA MATÉRIA/BIMESTRE
window.limparTodoHistorico = async () => {
    const materia = materiaSelect.value;
    const bimestre = selectBimestre.value;

    if (!confirm("⚠️ ATENÇÃO: Isso apagará TODAS as faltas desta matéria no bimestre selecionado para estes alunos. Deseja continuar?"))
        return;

    try {
        const checkboxes = listaAlunosFaltas.querySelectorAll("input[type='checkbox']");

        for (let cb of checkboxes) {
            const uid = cb.value;
            const refP = `grades/${uid}/${materia}/${bimestre}`;

            await update(ref(db, refP), {
                faltas: 0,
                historicoFaltas: null
            });
        }

        alert("Todo o histórico foi limpo!");
        carregarHistoricoFaltas();
    } catch (e) {
        console.error(e);
        alert("Erro ao limpar tudo.");
    }
};

// 💾 SALVAR NOVAS FALTAS
btnSalvarFaltas.addEventListener("click", async () => {
    const materia = materiaSelect.value;
    const dataFalta = dataFaltaInput.value;
    const bimestre = selectBimestre.value;

    if (!materia || !dataFalta || !bimestre)
        return alert("Preencha matéria, data e bimestre!");

    const selecionados = [...listaAlunosFaltas.querySelectorAll("input:checked")]
        .map(cb => cb.value);

    if (selecionados.length === 0)
        return alert("Selecione os alunos que faltaram.");

    btnSalvarFaltas.disabled = true;
    btnSalvarFaltas.innerText = "Salvando...";

    try {
        for (let uid of selecionados) {
            const refP = `grades/${uid}/${materia}/${bimestre}`;
            let snap = await get(ref(db, refP));
            let dados = snap.val();

            if (!dados) {
                dados = { p1: 0, p2: 0, trabalhos: 0, recuperacao: "", media: 0, faltas: 0, historicoFaltas: {} };
                await set(ref(db, refP), dados);
            }

            const snapHist = await get(ref(db, `${refP}/historicoFaltas`));
            let jaExiste = false;

            if (snapHist.exists()) {
                Object.values(snapHist.val()).forEach(d => {
                    if (d === dataFalta) jaExiste = true;
                });
            }

            if (!jaExiste) {
                await push(ref(db, `${refP}/historicoFaltas`), dataFalta);
                await update(ref(db, refP), {
                    faltas: (parseInt(dados.faltas) || 0) + 1
                });
            }
        }

        alert("Faltas lançadas!");
        dataFaltaInput.value = "";
        listaAlunosFaltas.querySelectorAll("input:checked").forEach(i => i.checked = false);
        carregarHistoricoFaltas();

    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    } finally {
        btnSalvarFaltas.disabled = false;
        btnSalvarFaltas.innerText = "Salvar Faltas";
    }
});
    // 📖 LÓGICA DE CONTEÚDOS
    async function carregarConteudos() {
        const materia = materiaSelect.value;
        if (!materia) return;
        try {
            const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
            const dados = snap.val();
            listaConteudos.innerHTML = "";
            if (!dados) {
                listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado.</li>";
                return;
            }
            Object.keys(dados).reverse().forEach(k => {
                const c = dados[k];
                const li = document.createElement("li");
                li.innerHTML = `
                    <span><strong>[${c.bimestre}º Bim]</strong> ${c.data} - ${c.conteudo}</span>
                    <div class="botoes-lista">
                        <button class="btn-editar" onclick="window.editarConteudo('${k}', '${c.data}', '${c.conteudo}', '${c.bimestre}')">Editar</button>
                        <button class="btn-excluir" onclick="window.excluirConteudo('${k}')">Excluir</button>
                    </div>
                `;
                listaConteudos.appendChild(li);
            });
        } catch (e) { console.error(e); }
    }

    btnSalvarConteudo.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        if (!materia || !conteudoInput.value) return alert("Preencha os campos!");
        const dados = { data: dataAulaInput.value, conteudo: conteudoInput.value.trim(), bimestre: bimestreConteudo.value };
        try {
            if (idEdicaoAtual) {
                await set(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${idEdicaoAtual}`), dados);
                idEdicaoAtual = null;
                btnSalvarConteudo.innerText = "Salvar Conteúdo";
            } else {
                await set(push(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`)), dados);
            }
            conteudoInput.value = "";
            carregarConteudos();
            alert("Conteúdo salvo!");
        } catch (e) { alert("Erro ao salvar."); }
    });

    window.toggleLista = () => {
        const lista = document.getElementById("listaConteudos");
        const btn = document.getElementById("btnToggleLista");
        lista.classList.toggle("escondido");
        btn.innerText = lista.classList.contains("escondido") ? "Mostrar" : "Esconder";
    };

    window.excluirConteudo = async (id) => {
        if (confirm("Deseja excluir este conteúdo?")) {
            await remove(ref(db, `conteudos/${auth.currentUser.uid}/${materiaSelect.value}/${id}`));
            carregarConteudos();
        }
    };

    window.editarConteudo = (id, data, conteudo, bimestre) => {
        idEdicaoAtual = id;
        dataAulaInput.value = data;
        conteudoInput.value = conteudo;
        bimestreConteudo.value = bimestre;
        btnSalvarConteudo.innerText = "Atualizar Conteúdo";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 🚪 LOGOUT E INICIALIZAÇÃO
    document.querySelector(".btn-logout").addEventListener("click", async (e) => {
        e.preventDefault();
        if (confirm("Deseja sair?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });

    inicializarFiltros();
}