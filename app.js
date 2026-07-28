// ==========================================
// 0. AUTENTICAÇÃO E SEGURANÇA AVANÇADA
// ==========================================
const usuarioLogado = sessionStorage.getItem('logado');
const perfilUsuario = sessionStorage.getItem('perfil');
const urlAtual = window.location.href;

if (usuarioLogado !== 'true') {
    window.location.href = 'login.html';
} else {
    if (perfilUsuario === 'funcionario') {
        if (urlAtual.includes('estoque.html') || urlAtual.includes('financeiro.html')) {
            alert("⚠️ ACESSO NEGADO! Apenas administradores podem acessar esta área.");
            window.location.href = 'index.html'; 
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (perfilUsuario === 'funcionario') {
        const btnEstoque = document.getElementById('menuEstoque');
        const btnFinanc = document.getElementById('menuFinanceiro');
        if (btnEstoque) btnEstoque.style.display = 'none';
        if (btnFinanc) btnFinanc.style.display = 'none';
    }
});

function fazerLogout() {
    sessionStorage.removeItem('logado');
    sessionStorage.removeItem('perfil');
    window.location.href = 'login.html';
}

// ==========================================
// 1. CONEXÃO COM O FIREBASE (NUVEM DO GOOGLE)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDkiemFDyZiBrswwqgSr5xmFblqbkLL6LY",
    authDomain: "meu-sistema-de-vendas-608d3.firebaseapp.com",
    databaseURL: "https://meu-sistema-de-vendas-608d3-default-rtdb.firebaseio.com",
    projectId: "meu-sistema-de-vendas-608d3",
    storageBucket: "meu-sistema-de-vendas-608d3.firebasestorage.app",
    messagingSenderId: "202535291068",
    appId: "1:202535291068:web:99f0e6236bbeac0fd6a8b9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Memória Cache (Garante que o sistema continue ultrarrápido)
let estoqueLocal = [];
let vendasLocal = [];
let clientesLocal = [];
let movsLocal = [];

// ==========================================
// MIGRAR DADOS ANTIGOS PARA A NUVEM (RODA SÓ UMA VEZ)
// ==========================================
get(ref(db, 'banco_migrado')).then((snapshot) => {
    if (!snapshot.exists()) {
        const est = JSON.parse(localStorage.getItem('meuEstoque')) || [];
        const ven = JSON.parse(localStorage.getItem('minhasVendas')) || [];
        const cli = JSON.parse(localStorage.getItem('meusClientes')) || [];
        const mov = JSON.parse(localStorage.getItem('historicoMov')) || [];

        if(est.length > 0 || ven.length > 0 || cli.length > 0) {
            set(ref(db, 'estoque'), est);
            set(ref(db, 'vendas'), ven);
            set(ref(db, 'clientes'), cli);
            set(ref(db, 'movimentacoes'), mov);
            set(ref(db, 'banco_migrado'), true);
            console.log("MIGRAÇÃO CONCLUÍDA: Seus dados locais foram para a nuvem!");
        } else {
            set(ref(db, 'banco_migrado'), true); // Marca como pronto mesmo se for vazio
        }
    }
});

// ==========================================
// "ESCUTADORES" EM TEMPO REAL (Se mudar no celular, muda no PC na hora)
// ==========================================
onValue(ref(db, 'estoque'), (snapshot) => {
    estoqueLocal = snapshot.val() || [];
    if (document.getElementById('listaEstoque')) atualizarTelaEstoque();
    if (document.getElementById('produtoVenda')) atualizarDropdownVendas();
});

onValue(ref(db, 'vendas'), (snapshot) => {
    vendasLocal = snapshot.val() || [];
    if (document.getElementById('listaVendasFinanceiro')) filtrarFinanceiro();
    if (document.getElementById('historicoCliente')) atualizarPainelCliente();
});

onValue(ref(db, 'clientes'), (snapshot) => {
    clientesLocal = snapshot.val() || [];
    if (document.getElementById('listaDeClientes')) atualizarListaClientes();
    atualizarDropdownsClientes();
});

onValue(ref(db, 'movimentacoes'), (snapshot) => {
    movsLocal = snapshot.val() || [];
    if (document.getElementById('listaMovimentacoes')) atualizarTelaMovimentacoes();
});

// Funções para pegar e salvar dados
function getEstoque() { return estoqueLocal; }
function salvarEstoque(dados) { set(ref(db, 'estoque'), dados); }

function getVendas() { return vendasLocal; }
function salvarVendas(dados) { set(ref(db, 'vendas'), dados); }

function getClientes() { return clientesLocal; }
function salvarClientes(dados) { set(ref(db, 'clientes'), dados); }

function getMovimentacoes() { return movsLocal; }
function salvarMovimentacoes(dados) { set(ref(db, 'movimentacoes'), dados); }

function registrarMovimentacao(tipo, nomeProduto, quantidade, motivo) {
    const movs = getMovimentacoes();
    movs.push({ id: Date.now(), data: new Date().toLocaleString('pt-BR'), tipo, nomeProduto, quantidade, motivo });
    salvarMovimentacoes(movs);
}

// ==========================================
// 2. MÓDULO DE ESTOQUE E CADASTRO
// ==========================================
async function buscarDadosDoProdutoPorCodigo(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        const inputCodigo = document.getElementById('codigoBarrasProduto');
        const codigo = inputCodigo.value.trim();
        if (!codigo) return;
        const nomeInput = document.getElementById('nomeProduto');
        const tipoInput = document.getElementById('tipoProduto');
        
        nomeInput.value = "Buscando informações na internet... ⏳";
        const estoque = getEstoque();
        const produtoLocal = estoque.find(p => p.codigoBarras === codigo);
        
        if (produtoLocal) {
            nomeInput.value = produtoLocal.nome;
            tipoInput.value = produtoLocal.tipo || "";
            document.getElementById('custoProduto').value = produtoLocal.custo || "";
            document.getElementById('precoProduto').value = produtoLocal.preco || "";
            document.getElementById('qtdProduto').focus();
            return;
        }

        try {
            const resposta = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
            const dados = await resposta.json();
            if (dados.status === 1 && dados.product) {
                nomeInput.value = dados.product.product_name || dados.product.generic_name || "Nome não identificado";
                if (dados.product.categories) {
                    const categorias = dados.product.categories.split(',');
                    tipoInput.value = categorias[0].trim();
                } else { tipoInput.value = "Geral"; }
                document.getElementById('custoProduto').focus();
            } else {
                nomeInput.value = "";
                alert("Produto não encontrado no banco público. Digite a descrição.");
                nomeInput.focus();
            }
        } catch (erro) {
            nomeInput.value = "";
            alert("Sem conexão para busca. Digite manualmente.");
            nomeInput.focus();
        }
    }
}

function cadastrarProduto() {
    const inputNome = document.getElementById('nomeProduto');
    if (!inputNome) return;
    const nome = inputNome.value.trim();
    const inputCodigo = document.getElementById('codigoBarrasProduto');
    const codigoBarras = inputCodigo ? inputCodigo.value.trim() : "";
    const tipo = document.getElementById('tipoProduto').value.trim();
    const custo = parseFloat(document.getElementById('custoProduto').value);
    const preco = parseFloat(document.getElementById('precoProduto').value);
    const validade = document.getElementById('validadeProduto').value;
    const quantidade = parseInt(document.getElementById('qtdProduto').value);

    if (nome === '' || isNaN(preco) || isNaN(quantidade)) return alert("Preencha Descrição, Valor e Quantidade!");

    const estoque = getEstoque();
    if (codigoBarras !== "" && estoque.some(p => p.codigoBarras === codigoBarras)) {
        return alert("Este código de barras já está cadastrado!");
    }

    estoque.push({ id: Date.now().toString(), codigoBarras, nome, tipo, custo: isNaN(custo) ? 0 : custo, preco, validade, quantidade });
    salvarEstoque(estoque);

    inputNome.value = ''; document.getElementById('tipoProduto').value = '';
    if(inputCodigo) inputCodigo.value = ''; 
    document.getElementById('custoProduto').value = ''; document.getElementById('precoProduto').value = '';
    document.getElementById('validadeProduto').value = ''; document.getElementById('qtdProduto').value = '';
    alert("Produto salvo na Nuvem!");
}

function atualizarTelaEstoque() {
    const listaHTML = document.getElementById('listaEstoque');
    const selectFiltro = document.getElementById('filtroCategoriaEstoque');
    if (!listaHTML) return;

    const estoque = getEstoque();
    let categoriaSelecionada = selectFiltro ? selectFiltro.value : "";
    if (selectFiltro) {
        const categoriasUnicas = [...new Set(estoque.map(p => p.tipo || 'Geral'))].sort();
        selectFiltro.innerHTML = '<option value="">Todas as Categorias</option>';
        categoriasUnicas.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat; option.textContent = cat;
            if (cat === categoriaSelecionada) option.selected = true;
            selectFiltro.appendChild(option);
        });
    }

    let estoqueFiltrado = categoriaSelecionada !== "" ? estoque.filter(p => (p.tipo || 'Geral') === categoriaSelecionada) : estoque;
    estoqueFiltrado.sort((a, b) => {
        if (!a.validade) return 1; if (!b.validade) return -1;
        return new Date(a.validade) - new Date(b.validade);
    });

    let somaCusto = 0, somaVenda = 0;
    listaHTML.innerHTML = '';
    estoqueFiltrado.forEach(produto => {
        if (produto.quantidade > 0) {
            somaCusto += (produto.custo * produto.quantidade);
            somaVenda += (produto.preco * produto.quantidade);
        }
        const li = document.createElement('li');
        li.style.marginBottom = "15px"; li.style.paddingBottom = "10px"; li.style.borderBottom = "1px solid #ccc";

        let valText = produto.validade ? produto.validade.split('-').reverse().join('/') : "Sem validade";
        let valColor = produto.validade ? "red" : "gray";
        let codTexto = produto.codigoBarras ? `|||| Cód: ${produto.codigoBarras}` : "Sem código";

        let botoes = `<button onclick="baixarEstoqueManual('${produto.id}')" style="margin-top: 8px; background-color: #ff9933; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">📉 Baixa Manual</button>`;
        if (produto.quantidade === 0) {
            botoes += `<button onclick="excluirProdutoDefinitivo('${produto.id}')" style="margin-top: 8px; margin-left: 10px; background-color: #cc0000; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">🗑️ Excluir Item</button>`;
        }
        li.innerHTML = `<strong>${produto.nome}</strong> <small>(${produto.tipo || 'Geral'})</small><br>
            <span style="color: #34495e; font-size: 0.9em; background: #ecf0f1; padding: 2px 5px; border-radius: 3px;">${codTexto}</span><br>
            <span style="color: ${valColor};">📅 Validade: <strong>${valText}</strong></span> | 📦 Estoque: <strong style="color: ${produto.quantidade === 0 ? 'red' : 'black'};">${produto.quantidade} un.</strong><br>
            💰 Compra: R$ ${parseFloat(produto.custo).toFixed(2)} | 🏷️ Revenda: R$ ${parseFloat(produto.preco).toFixed(2)}<br>${botoes}`;
        listaHTML.appendChild(li);
    });
    if (document.getElementById('totalCustoEstoque')) document.getElementById('totalCustoEstoque').textContent = `R$ ${somaCusto.toFixed(2)}`;
    if (document.getElementById('totalVendaEstoque')) document.getElementById('totalVendaEstoque').textContent = `R$ ${somaVenda.toFixed(2)}`;
    if (document.getElementById('lucroProjetadoEstoque')) document.getElementById('lucroProjetadoEstoque').textContent = `R$ ${(somaVenda - somaCusto).toFixed(2)}`;
}

function baixarEstoqueManual(idProduto) {
    const estoque = getEstoque();
    const index = estoque.findIndex(p => p.id == idProduto); 
    if (index === -1) return;
    const prod = estoque[index];
    const inputQtd = prompt(`Remover quantas unidades de "${prod.nome}"? (Estoque: ${prod.quantidade})`);
    if (!inputQtd) return;
    const qtd = parseInt(inputQtd);
    if (isNaN(qtd) || qtd <= 0 || qtd > prod.quantidade) return alert("Quantidade inválida!");
    const motivo = prompt(`Motivo da remoção:`);
    if (!motivo) return alert("Motivo obrigatório.");

    if (confirm(`Confirma baixa de ${qtd}x "${prod.nome}"?`)) {
        estoque[index].quantidade -= qtd;
        salvarEstoque(estoque);
        registrarMovimentacao("Baixa Manual", prod.nome, qtd, motivo);
    }
}

function excluirProdutoDefinitivo(idProduto) {
    const estoque = getEstoque();
    const index = estoque.findIndex(p => p.id == idProduto); 
    if (index === -1) return;
    const prod = estoque[index];
    if (prod.quantidade > 0) return alert("Apenas produtos zerados podem ser excluídos.");

    if (confirm(`Deseja apagar "${prod.nome}" da nuvem?`)) {
        estoque.splice(index, 1);
        salvarEstoque(estoque);
        registrarMovimentacao("Exclusão", prod.nome, 0, "Removido");
    }
}

function atualizarTelaMovimentacoes() {
    const listaHTML = document.getElementById('listaMovimentacoes');
    if (!listaHTML) return;
    listaHTML.innerHTML = '';
    getMovimentacoes().slice().reverse().forEach(mov => {
        const li = document.createElement('li');
        li.style.marginBottom = "8px";
        let cor = mov.tipo === "Exclusão" ? "darkred" : "darkorange";
        li.innerHTML = `<small>[${mov.data}]</small> <strong style="color: ${cor};">[${mov.tipo}]</strong> ${mov.nomeProduto} (Qtd: <strong>${mov.quantidade}</strong>) <br><span style="color: gray; font-size: 0.9em;">Motivo: ${mov.motivo}</span>`;
        listaHTML.appendChild(li);
    });
}

// ==========================================
// 3. MÓDULO FRENTE DE CAIXA
// ==========================================
let carrinho = [];

function buscarPorCodigoBarras(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        const inputLeitor = document.getElementById('leitorCodigoBarras');
        const codigoDigitado = inputLeitor.value.trim();
        if (!codigoDigitado) return;
        const estoque = getEstoque();
        const produto = estoque.find(p => p.codigoBarras === codigoDigitado && p.quantidade > 0);
        if (produto) {
            document.getElementById('produtoVenda').value = produto.id;
            preencherPrecoVenda();
            document.getElementById('qtdVenda').value = 1; 
            inputLeitor.value = ''; 
            document.getElementById('qtdVenda').focus(); 
        } else {
            alert("Produto sem estoque ou não encontrado.");
            inputLeitor.value = ''; 
        }
    }
}

function atualizarDropdownVendas() {
    const dropdown = document.getElementById('produtoVenda');
    const campoBusca = document.getElementById('buscaProduto');
    if (!dropdown) return;
    const termo = campoBusca ? campoBusca.value.toLowerCase() : "";
    const idSelecionado = dropdown.value; 

    dropdown.innerHTML = '<option value="">Selecione um produto</option>';
    const disponivel = getEstoque().filter(produto => {
        const qtdNoCarrinho = carrinho.filter(i => i.idProduto == produto.id).reduce((s, i) => s + i.qtd, 0);
        return (produto.quantidade - qtdNoCarrinho) > 0 && produto.nome.toLowerCase().includes(termo);
    });
    disponivel.sort((a, b) => a.nome.localeCompare(b.nome));
    disponivel.forEach(p => {
        const qtdNoCarrinho = carrinho.filter(i => i.idProduto == p.id).reduce((s, i) => s + i.qtd, 0);
        const op = document.createElement('option');
        op.value = p.id;
        op.textContent = `${p.nome} (R$ ${parseFloat(p.preco).toFixed(2)}) — Restam: ${p.quantidade - qtdNoCarrinho}`;
        if (p.id == idSelecionado) op.selected = true; 
        dropdown.appendChild(op);
    });
}

function preencherPrecoVenda() {
    const idProduto = document.getElementById('produtoVenda').value;
    const inputValor = document.getElementById('valorVenda');
    if (!idProduto || !inputValor) return;
    const produto = getEstoque().find(p => p.id == idProduto); 
    if (produto) {
        inputValor.value = parseFloat(produto.preco).toFixed(2); 
        if (document.getElementById('descontoVenda')) document.getElementById('descontoVenda').value = '';
    }
}

function aplicarDescontoProduto() {
    const idProduto = document.getElementById('produtoVenda').value;
    const inputValor = document.getElementById('valorVenda');
    const inputDesc = document.getElementById('descontoVenda');
    if (!idProduto || !inputValor || !inputDesc) return;
    let desc = parseFloat(inputDesc.value) || 0;
    if (desc > 20) { alert("Máximo 20%!"); desc = 20; inputDesc.value = 20; }
    if (desc < 0) { desc = 0; inputDesc.value = 0; }
    const produto = getEstoque().find(p => p.id == idProduto); 
    if (produto) inputValor.value = (produto.preco - (produto.preco * (desc / 100))).toFixed(2);
}

function adicionarAoCarrinho() {
    const idProduto = document.getElementById('produtoVenda').value;
    const qtd = parseInt(document.getElementById('qtdVenda').value);
    const valor = parseFloat(document.getElementById('valorVenda').value);
    if (!idProduto || isNaN(qtd) || qtd <= 0 || isNaN(valor)) return alert("Preencha corretamente.");

    const produto = getEstoque().find(p => p.id == idProduto); 
    const qtdJaTem = carrinho.filter(i => i.idProduto == idProduto).reduce((s, i) => s + i.qtd, 0);

    if ((qtd + qtdJaTem) > produto.quantidade) return alert("Estoque insuficiente.");

    carrinho.push({ idProduto, nome: produto.nome, qtd, valorUnitario: valor, valorTotalItem: qtd * valor });
    document.getElementById('qtdVenda').value = ''; document.getElementById('valorVenda').value = '';
    document.getElementById('descontoVenda').value = ''; document.getElementById('produtoVenda').value = ''; 
    if (document.getElementById('buscaProduto')) document.getElementById('buscaProduto').value = '';
    atualizarTelaCarrinho();
}

function removerDoCarrinho(index) {
    carrinho.splice(index, 1);
    atualizarTelaCarrinho();
}

function atualizarTelaCarrinho() {
    const lista = document.getElementById('listaCarrinho');
    const total = document.getElementById('totalCarrinho');
    if (!lista) return;
    lista.innerHTML = ''; let soma = 0;
    carrinho.forEach((item, index) => {
        soma += item.valorTotalItem;
        lista.innerHTML += `<li>${item.qtd}x ${item.nome} (R$ ${item.valorUnitario.toFixed(2)}) - Total: R$ ${item.valorTotalItem.toFixed(2)} <button onclick="removerDoCarrinho(${index})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;">❌</button></li>`;
    });
    total.textContent = `Total: R$ ${soma.toFixed(2)}`;
    atualizarDropdownVendas();
}

function finalizarVenda() {
    if (carrinho.length === 0) return alert("Carrinho vazio!");
    const idCliente = document.getElementById('clienteVenda').value;
    const parc = parseInt(document.getElementById('formaPagamento').value);
    const pago = parseFloat(document.getElementById('valorPago').value) || 0;

    let totalVenda = carrinho.reduce((s, i) => s + i.valorTotalItem, 0);
    if (parc > 1) totalVenda = totalVenda * (1 + (0.009 * parc));
    const valorPendente = totalVenda - pago;
    const clienteEncontrado = idCliente ? getClientes().find(c => c.id == idCliente) : null;

    if (valorPendente > 0 && !clienteEncontrado) {
        alert("Aviso: Venda fiado sem cliente. A Promissória sairá em branco.");
    }

    const estoque = getEstoque();
    carrinho.forEach(item => {
        const index = estoque.findIndex(p => p.id == item.idProduto); 
        if (index !== -1) estoque[index].quantidade -= item.qtd;
    });
    salvarEstoque(estoque);

    const novaVenda = {
        idVenda: Date.now(), idCliente, clienteNome: clienteEncontrado ? clienteEncontrado.nome : "Consumidor Final",
        itens: [...carrinho], parcelas: parc, valorTotal: totalVenda, valorPago: pago, valorPendente, data: new Date().toLocaleDateString('pt-BR')
    };

    const vendas = getVendas();
    vendas.push(novaVenda);
    salvarVendas(vendas);

    if (valorPendente > 0) gerarNotaPromissoria(novaVenda, clienteEncontrado);
    else alert(`Venda salva na nuvem! Total recebido: R$ ${totalVenda.toFixed(2)}`);

    carrinho = []; atualizarTelaCarrinho();
    document.getElementById('valorPago').value = '0'; document.getElementById('formaPagamento').value = '1';
    document.getElementById('clienteVenda').value = '';
}

function gerarNotaPromissoria(venda, cliente) {
    const janela = window.open('', 'Promissoria', 'width=750,height=500');
    const nomeCliente = cliente ? cliente.nome : "__________________________________";
    const cpfCliente = cliente ? cliente.cpf : "___________________";
    let endCliente = "__________________________________";
    if (cliente) endCliente = cliente.rua ? `${cliente.rua}, ${cliente.numero || 'S/N'} - ${cliente.cidade}` : (cliente.endereco || endCliente);
    
    const valorFormatado = venda.valorPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    janela.document.write(`
    <html><body style="font-family:Arial; padding:20px;">
        <div style="border:2px solid #000; padding:30px; max-width:650px; margin:0 auto;">
            <h2>NOTA PROMISSÓRIA <span style="float:right;">${valorFormatado}</span></h2><hr>
            <p>Vencimento: ____/____/________ &nbsp;&nbsp;&nbsp; (Nº Documento: ${venda.idVenda})</p>
            <p>Pagarei por esta única via a quantia de <strong>${valorFormatado}</strong> a favor de <strong>MINHA LOJA</strong>.</p>
            <p><strong>Devedor:</strong> ${nomeCliente}<br><strong>CPF:</strong> ${cpfCliente}<br><strong>End:</strong> ${endCliente}</p>
            <br><br><div style="text-align:center; border-top:1px solid #000; width:80%; margin:auto;">Assinatura</div>
        </div>
        <script>window.onload=function(){window.print();}</script>
    </body></html>`);
    janela.document.close();
}

// ==========================================
// 4. CLIENTES E RELATÓRIOS
// ==========================================
let clienteEdicaoId = null;
let documentoBase64Atual = ""; 

function mascaraCPF(input) { let v = input.value.replace(/\D/g, ""); v = v.replace(/(\d{3})(\d)/, "$1.$2"); v = v.replace(/(\d{3})(\d)/, "$1.$2"); input.value = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }
function mascaraTelefone(input) { let v = input.value.replace(/\D/g, ""); v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); input.value = v.replace(/(\d{5})(\d)/, "$1-$2"); }
function mascaraCEP(input) { let v = input.value.replace(/\D/g, ""); input.value = v.replace(/^(\d{5})(\d)/, "$1-$2"); }

function processarImagemDocumento(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = 600; canvas.height = (img.height * 600) / img.width;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            documentoBase64Atual = canvas.toDataURL('image/jpeg', 0.5); // Comprime bem para Nuvem
            document.getElementById('previewDocumento').style.display = 'block';
            document.getElementById('imgPreview').src = documentoBase64Atual;
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}
function removerFotoDocumento() { documentoBase64Atual = ""; if(document.getElementById('previewDocumento')) document.getElementById('previewDocumento').style.display = 'none'; }

function cadastrarCliente() {
    const inputNome = document.getElementById('nomeCliente'); if (!inputNome) return;
    const nome = inputNome.value.trim(), cpf = document.getElementById('cpfCliente').value.trim();
    if (!nome || !cpf) return alert("Nome e CPF são obrigatórios!");
    const clientes = getClientes();
    
    if (clienteEdicaoId) {
        const index = clientes.findIndex(c => c.id === clienteEdicaoId);
        if (index !== -1) {
            clientes[index] = { ...clientes[index], nome, cpf, telefone: document.getElementById('telefoneCliente').value, cep: document.getElementById('cepCliente').value, rua: document.getElementById('ruaCliente').value, numero: document.getElementById('numeroCliente').value, bairro: document.getElementById('bairroCliente').value, cidade: document.getElementById('cidadeCliente').value, documento: documentoBase64Atual };
        }
        cancelarEdicaoCliente();
    } else {
        clientes.push({ id: Date.now().toString(), nome, cpf, telefone: document.getElementById('telefoneCliente').value, cep: document.getElementById('cepCliente').value, rua: document.getElementById('ruaCliente').value, numero: document.getElementById('numeroCliente').value, bairro: document.getElementById('bairroCliente').value, cidade: document.getElementById('cidadeCliente').value, documento: documentoBase64Atual });
        inputNome.value = ''; document.getElementById('cpfCliente').value = ''; removerFotoDocumento();
    }
    salvarClientes(clientes); alert("Cliente salvo na Nuvem!");
}

function editarCliente(id) {
    const cliente = getClientes().find(c => c.id === id); if (!cliente) return;
    document.getElementById('nomeCliente').value = cliente.nome; document.getElementById('cpfCliente').value = cliente.cpf;
    clienteEdicaoId = id; document.getElementById('btnCancelarEdicao').style.display = 'block';
    if(cliente.documento) { documentoBase64Atual = cliente.documento; document.getElementById('imgPreview').src = cliente.documento; document.getElementById('previewDocumento').style.display = 'block'; }
}
function cancelarEdicaoCliente() { clienteEdicaoId = null; document.getElementById('nomeCliente').value = ''; document.getElementById('cpfCliente').value = ''; document.getElementById('btnCancelarEdicao').style.display = 'none'; removerFotoDocumento(); }
function verDocumento(id) {
    const c = getClientes().find(c => c.id === id);
    if (c && c.documento) window.open('', '_blank').document.write(`<html><body style="background:#000; text-align:center;"><img src="${c.documento}" style="max-height:90vh;"></body></html>`);
}

function atualizarListaClientes() {
    const lista = document.getElementById('listaDeClientes'); if (!lista) return;
    lista.innerHTML = '';
    getClientes().forEach(c => {
        lista.innerHTML += `<li style="margin-bottom:10px;"><strong>${c.nome}</strong> (CPF: ${c.cpf}) <button onclick="editarCliente('${c.id}')">✏️</button> ${c.documento ? `<button onclick="verDocumento('${c.id}')">📷 Doc</button>` : ''}</li>`;
    });
}
function atualizarDropdownsClientes() {
    const dpVenda = document.getElementById('clienteVenda');
    if (dpVenda) {
        dpVenda.innerHTML = '<option value="">Avulso</option>';
        getClientes().forEach(c => dpVenda.innerHTML += `<option value="${c.id}">${c.nome}</option>`);
    }
}
function atualizarPainelCliente() {
    const id = document.getElementById('filtroCliente').value, res = document.getElementById('resumoFinanceiro');
    if (!res || !id) return res ? res.innerHTML = '' : null;
    let pend = 0; getVendas().filter(v => v.idCliente == id).forEach(v => pend += v.valorPendente);
    res.innerHTML = `<p style="color:${pend > 0 ? 'red' : 'green'};">A Receber: R$ ${pend.toFixed(2)}</p>`;
}
function filtrarFinanceiro() {
    const lista = document.getElementById('listaVendasFinanceiro'); if (!lista) return;
    lista.innerHTML = ''; let fat = 0, rec = 0, pen = 0;
    getVendas().forEach(v => { fat += v.valorTotal; rec += v.valorPago; pen += v.valorPendente; lista.innerHTML += `<li>${v.data} - Total: R$ ${v.valorTotal.toFixed(2)} | <span style="color:red">Pendente: R$ ${v.valorPendente.toFixed(2)}</span></li>`; });
    document.getElementById('totalFaturado').innerText = `R$ ${fat.toFixed(2)}`;
    document.getElementById('totalAReceber').innerText = `R$ ${pen.toFixed(2)}`;
}

// ==========================================
// 5. EXPORTANDO FUNÇÕES PARA O HTML (MÓDULO)
// ==========================================
// Como usamos Módulos, o HTML precisa saber onde estão as funções:
window.fazerLogout = fazerLogout;
window.buscarDadosDoProdutoPorCodigo = buscarDadosDoProdutoPorCodigo;
window.cadastrarProduto = cadastrarProduto;
window.atualizarTelaEstoque = atualizarTelaEstoque;
window.baixarEstoqueManual = baixarEstoqueManual;
window.excluirProdutoDefinitivo = excluirProdutoDefinitivo;
window.buscarPorCodigoBarras = buscarPorCodigoBarras;
window.atualizarDropdownVendas = atualizarDropdownVendas;
window.preencherPrecoVenda = preencherPrecoVenda;
window.aplicarDescontoProduto = aplicarDescontoProduto;
window.adicionarAoCarrinho = adicionarAoCarrinho;
window.removerDoCarrinho = removerDoCarrinho;
window.finalizarVenda = finalizarVenda;
window.mascaraCPF = mascaraCPF;
window.mascaraTelefone = mascaraTelefone;
window.mascaraCEP = mascaraCEP;
window.processarImagemDocumento = processarImagemDocumento;
window.removerFotoDocumento = removerFotoDocumento;
window.cadastrarCliente = cadastrarCliente;
window.editarCliente = editarCliente;
window.cancelarEdicaoCliente = cancelarEdicaoCliente;
window.verDocumento = verDocumento;
window.atualizarPainelCliente = atualizarPainelCliente;
window.filtrarFinanceiro = filtrarFinanceiro;