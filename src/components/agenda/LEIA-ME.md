# Agenda de contatos — Share Brasil

Código completo da aba Agenda e dos componentes de anexo, pronto para integrar ao projeto React + TypeScript existente. Usa `lucide-react`, o `Dialog` já presente no projeto e as funções de `@/lib/colaborador-api`. Não é uma aplicação independente e não inclui seu backend ou as implementações privadas dessas dependências.

## Arquivos

- `AgendaContatos.tsx`: listagem, busca, detalhes, criação, edição e exclusão de contatos; formulário completo com campos de hangar condicionais.
- `LinhaAnexo.tsx`: componente controlado para seleção e envio de arquivo, categoria opcional e estado de envio.
- `AnexosIntegrados.tsx`: componentes prontos para upload em pasta, cliente, holding e sócio, usando a API original.
- `agenda-contatos.css`: CSS local de layout e aparência, compatível com o Tailwind existente. Importe depois do CSS global; não substitua o CSS global anexado.

## 1. Instalar os arquivos

Copie os quatro arquivos de código para `src/components/agenda/`. Não precisa adicionar bibliotecas além das já utilizadas no código enviado. O CSS é importado pelos componentes. O prefixo `ac-` evita interferir nas outras telas. Os fundos são sempre escuros, inclusive se o tema global estiver em modo claro. Sem neon, gradientes ou blur nos componentes novos.

## 2. Substituir a aba de contatos

No arquivo que contém `ContatosClientesShareBrasil`, adicione:

```tsx
import { AgendaContatos } from "@/components/agenda/AgendaContatos";
import { AnexoPasta, AnexoCliente, AnexoSocio } from "@/components/agenda/AnexosIntegrados";
```

Substitua **toda** a declaração antiga `const contactsContent = (...)` por:

```tsx
const contactsContent = <AgendaContatos />;
```

O retorno da tela continua:

```tsx
{tab === "contatos"
  ? contactsContent
  : selected
    ? profileContent
    : clientListContent}
```

Remova os estados, filtros e handlers antigos usados exclusivamente pela agenda: `showNewContact`, `editingContact`, `contacts`, `contactSearch`, `selectedContact`, `form`, `visibleContacts`, `addContact`, `editContact`, `removeContact`. Remova os imports que ficarem sem uso, incluindo `CAMPOS_SERVICO_HANGAR`, se não for utilizado em outra tela. A nova aba faz sua própria busca; não mantenha os dois formulários renderizados.

No `refresh` do componente de cotistas, substitua o início:

```tsx
void Promise.all([buscarContatosShare(), buscarClientesShare()])
  .then(([c, data]) => {
```

por:

```tsx
void buscarClientesShare().then((data) => {
```

Remova `setContacts(c)` desse callback. Mantenha a transformação de holdings, os demais setters e o `.catch` já existentes. As abas de clientes, holdings, sócios e aeronaves continuam usando o código atual.

## 3. Substituir as linhas de anexo

Os novos anexos usam seleção seguida do botão **Anexar arquivo**. Remova as linhas antigas correspondentes para não duplicar os controles.

### Pasta de documentos

Em `DocumentosShareBrasil`, substitua o bloco de upload do cabeçalho da pasta por:

```tsx
{selectedFolderId && (
  <AnexoPasta
    key={selectedFolderId}
    pastaId={selectedFolderId}
    aoConcluir={refresh}
  />
)}
```

Para o título da pasta e a linha de anexo compartilharem a mesma linha quando houver espaço, use este wrapper no lugar do `md:flex-row` antigo:

```tsx
<div className="flex min-w-0 flex-wrap items-end gap-4">
  <div className="min-w-0 flex-[1_1_16rem]">
    <h2 className="break-words text-xl font-semibold text-slate-100">
      {selectedFolder?.nome || "Pasta"}
    </h2>
    <p className="mt-1 text-sm text-slate-400">{docs.length} arquivo(s)</p>
  </div>
  <div className="min-w-0 max-w-full flex-[2_1_28rem]">
    {selectedFolderId && (
      <AnexoPasta key={selectedFolderId} pastaId={selectedFolderId} aoConcluir={refresh} />
    )}
  </div>
</div>
```

Esse trecho substitui o wrapper inteiro do título + upload. Remova o elemento decorativo com `blur-3xl` do cabeçalho da pasta, se ainda estiver presente.

### Logo do cliente / holding

Retire o input de arquivo antigo da linha dos botões de edição e coloque o novo componente em um bloco próprio abaixo dela:

```tsx
{selectedClient && (
  <AnexoCliente
    key={`logo-${selectedClient}`}
    clienteId={selectedClient}
    holding={Boolean(selected?.holding)}
    tipo="logo"
    aoConcluir={refresh}
  />
)}
```

### Documentos do cliente

Substitua o bloco que contém `categorySelect(...)` e o input de arquivo por:

```tsx
{selectedClient && (
  <AnexoCliente
    key={`documentos-${selectedClient}`}
    clienteId={selectedClient}
    tipo="documento"
    aoConcluir={refresh}
  />
)}
```

### Documentos do sócio

Retire a categoria e o input antigos da linha dos botões e coloque em um bloco próprio abaixo dela:

```tsx
{currentSocio && (
  <AnexoSocio
    key={currentSocio.id}
    socioId={currentSocio.id}
    aoConcluir={refresh}
  />
)}
```

Remova os estados e handlers de upload que deixarem de ser utilizados. A agenda de contatos não ganhou anexos: o contrato enviado não tem API para anexar arquivos a contatos. Os anexos permanecem nas entidades já suportadas.

## Por que o layout se ajusta

O formulário usa `repeat(auto-fit, minmax(min(100%, 210px), 1fr))`. Seções inteiras usam `grid-column: 1 / -1`. Isso elimina o `xl:col-span-6` da grade original de três colunas, que criava colunas implícitas. Todos os itens flex/grid que precisam encolher têm `min-width: 0`.

A linha de anexo usa container queries: abaixo de 640px **de largura do próprio componente**, os controles ficam em linhas separadas; com mais espaço, categoria, arquivo e ações ficam lado a lado. Navegadores sem container queries recebem a disposição vertical funcional. O nome longo do arquivo é abreviado visualmente, tem nome completo no `title` e permanece no input nativo acessível pelo teclado.

Não há `overflow-x: hidden` para esconder erros de largura. O diálogo tem largura limitada e rolagem vertical. Se o wrapper externo do sistema impõe uma largura mínima fixa, ele também precisa permitir encolhimento, por exemplo: `<main className="min-w-0 flex-1">` e grades com `minmax(0, 1fr)`.

## Regras preservadas

Nome e categoria obrigatórios; categoria personalizada em Outro; direcionamento de hotéis e combustíveis para seus módulos; disponibilidade e cobrança de GPU/Transfer; custo gratuito enviado como `GRATUITO`; valores cobrados positivos com até duas casas decimais. Valores em reais aceitam vírgula e são convertidos antes do envio. Dados de serviços ocultos são limpos do payload.

O envio bloqueia cliques repetidos. Falhas são exibidas dentro do formulário e mantêm o preenchimento. A exclusão pede confirmação. Arquivos só são limpos depois do envio bem-sucedido.

Referências de CSS: [MDN — minmax](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/minmax) e [MDN — container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries).

## Validação

Veja `VALIDACAO.md` para os resultados da verificação local. A execução contra as APIs reais depende do projeto da empresa, que não foi fornecido.
