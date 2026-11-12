import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Svg,
  Path,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import {
  calcularProposta,
  dataBR,
  moeda,
  validadeProposta,
  type EdicaoContrato,
} from './modelo';
import {
  recursosPropostaPadrao,
  registrarFontesProposta,
  type RecursosProposta,
} from './recursos-proposta';

const cor = {
  azul: '#132B3B',
  dourado: '#A98D62',
  texto: '#233542',
  secundario: '#63717A',
  creme: '#F5F2EC',
  linha: '#DDDCD5',
  branco: '#FFFFFF',
};
const s = StyleSheet.create({
  page: {
    paddingTop: 99,
    paddingBottom: 65,
    paddingHorizontal: 49,
    fontFamily: 'PropostaSans',
    fontSize: 9.5,
    color: cor.texto,
    lineHeight: 1.55,
  },
  header: {
    position: 'absolute',
    top: 24,
    left: 49,
    right: 49,
    height: 53,
    borderBottomWidth: 0.6,
    borderBottomColor: cor.linha,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: { width: 95, height: 38, objectFit: 'contain' },
  headerRight: { maxWidth: 300, textAlign: 'right', paddingTop: 5 },
  headerBrand: { fontSize: 7, color: cor.secundario },
  headerSection: {
    fontSize: 7,
    fontWeight: 600,
    color: cor.dourado,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    top: 799,
    left: 49,
    right: 49,
    height: 25,
    borderTopWidth: 0.55,
    borderTopColor: cor.linha,
    paddingTop: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: cor.secundario,
    fontSize: 6.8,
    lineHeight: 1.2,
  },
  footerBrand: { fontWeight: 600, letterSpacing: 0.8 },
  footerMiddle: { maxWidth: 285, textAlign: 'center' },
  eyebrow: {
    fontSize: 7.7,
    color: cor.dourado,
    fontWeight: 600,
    letterSpacing: 1.5,
    marginBottom: 13,
  },
  title: {
    fontFamily: 'PropostaSerif',
    fontSize: 28,
    lineHeight: 1.3,
    color: cor.azul,
    marginBottom: 20,
  },
  paragraph: { fontSize: 9.5, lineHeight: 1.6, marginBottom: 9 },
  opening: {
    fontSize: 10.4,
    fontWeight: 600,
    color: cor.azul,
    marginBottom: 17,
    lineHeight: 1.5,
  },
  identification: {
    padding: 13,
    backgroundColor: cor.creme,
    marginBottom: 20,
    borderRadius: 3,
  },
  row: { flexDirection: 'row', gap: 18 },
  column: { flex: 1 },
  label: {
    fontSize: 7,
    color: cor.secundario,
    letterSpacing: 0.55,
    marginBottom: 4,
  },
  value: { fontSize: 10, color: cor.azul, fontWeight: 600 },
  small: { fontSize: 8, color: cor.secundario, lineHeight: 1.5, marginTop: 4 },
  cover: {
    width: 595.28,
    height: 841.89,
    backgroundColor: cor.azul,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    fontFamily: 'PropostaSans',
    color: cor.branco,
  },
  // Compensa as margens transparentes do PNG oficial sem alterar a imagem.
  coverLogo: {
    position: 'absolute',
    left: 34.4,
    top: 29.2,
    width: 197,
    height: 72.92,
    objectFit: 'contain',
  },
  coverNumber: {
    position: 'absolute',
    right: 49,
    top: 52,
    maxWidth: 240,
    textAlign: 'right',
    fontSize: 7.5,
    color: '#A9BCC7',
  },
  coverLine: {
    position: 'absolute',
    left: 49,
    top: 134,
    width: 64,
    borderBottomWidth: 1.2,
    borderBottomColor: cor.dourado,
  },
  coverContent: { position: 'absolute', top: 165, left: 49, right: 49 },
  coverEyebrow: {
    fontSize: 8,
    color: '#C9B38B',
    fontWeight: 600,
    letterSpacing: 1.8,
    marginBottom: 32,
  },
  coverTitle: {
    fontFamily: 'PropostaSerif',
    color: cor.branco,
    maxLines: 4,
    textOverflow: 'ellipsis',
    lineHeight: 1.35,
    marginBottom: 21,
  },
  coverAircraft: {
    maxLines: 3,
    textOverflow: 'ellipsis',
    fontSize: 17,
    color: '#C9B38B',
    letterSpacing: 1.7,
    marginBottom: 29,
    lineHeight: 1.5,
  },
  coverScope: {
    maxLines: 3,
    textOverflow: 'ellipsis',
    fontSize: 10,
    color: '#CCD8DF',
    lineHeight: 1.7,
    maxWidth: 430,
  },
  coverClient: { position: 'absolute', left: 49, right: 49, bottom: 159 },
  coverClientLabel: {
    fontSize: 7,
    color: '#A9BCC7',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  coverClientValue: {
    maxLines: 3,
    textOverflow: 'ellipsis',
    fontSize: 11,
    color: '#DAE3E8',
    lineHeight: 1.5,
  },
  coverDate: {
    position: 'absolute',
    left: 49,
    right: 49,
    bottom: 103,
    fontSize: 9,
    color: '#DAE3E8',
  },
  service: { marginBottom: 14 },
  serviceHeader: {
    borderBottomWidth: 0.6,
    borderBottomColor: cor.linha,
    paddingBottom: 9,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  serviceIndex: { fontSize: 8, color: cor.dourado, width: 15 },
  serviceTitle: {
    fontWeight: 600,
    fontSize: 10.3,
    color: cor.azul,
    flex: 1,
    lineHeight: 1.45,
  },
  serviceAmount: {
    fontSize: 9,
    fontWeight: 600,
    color: cor.azul,
    maxWidth: 130,
    textAlign: 'right',
  },
  serviceIncluded: { fontSize: 8, color: cor.secundario },
  bullet: { flexDirection: 'row', gap: 9, marginBottom: 3 },
  bulletDot: { fontSize: 9, color: cor.dourado, width: 6 },
  bulletText: { fontSize: 9.2, lineHeight: 1.5, flex: 1 },
  sectionLabel: {
    fontWeight: 600,
    fontSize: 8,
    color: cor.dourado,
    letterSpacing: 0.9,
    marginTop: 0,
    marginBottom: 7,
  },
  conditions: {
    backgroundColor: cor.creme,
    borderRadius: 3,
    padding: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  price: {
    fontFamily: 'PropostaSerif',
    fontSize: 27,
    lineHeight: 1.25,
    color: cor.azul,
    marginTop: 3,
    marginBottom: 7,
  },
  priceUnit: {
    fontSize: 9.4,
    lineHeight: 1.5,
    color: cor.azul,
    marginBottom: 9,
  },
  total: { fontSize: 10, fontWeight: 600, color: cor.azul, marginBottom: 10 },
  closing: {
    fontFamily: 'PropostaSerif',
    fontSize: 12,
    lineHeight: 1.6,
    color: cor.azul,
    marginTop: 10,
    marginBottom: 8,
  },
  issuer: {
    marginTop: 8,
    borderTopWidth: 0.6,
    borderTopColor: cor.linha,
    paddingTop: 5,
  },
});
function Cabecalho({
  section,
  recursos,
}: {
  section: string;
  recursos: RecursosProposta;
}) {
  return (
    <View style={s.header} fixed>
      <Image src={recursos.logo} style={s.logo} />
      <View style={s.headerRight}>
        <Text style={s.headerBrand}>GERENCIAMENTO DE AERONAVES</Text>
        <Text style={s.headerSection}>
          {section.toLocaleUpperCase('pt-BR')}
        </Text>
      </View>
    </View>
  );
}
function Rodape({
  edicao: e,
  capa = false,
}: {
  edicao: EdicaoContrato;
  capa?: boolean;
}) {
  const color = capa ? '#83939D' : cor.secundario;
  return (
    <>
      <View
        style={[
          s.footer,
          ...(capa ? [{ borderTopColor: '#344C5A', color }] : []),
        ]}
        fixed
      >
        <Text style={s.footerBrand}>SHARE BRASIL</Text>
        <Text style={s.footerMiddle}>{e.numero || 'PROPOSTA COMERCIAL'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text
        fixed
        style={{
          position: 'absolute',
          top: 806,
          left: 506,
          right: 49,
          fontFamily: 'PropostaSans',
          fontSize: 6.8,
          color,
          lineHeight: 1.5,
          textAlign: 'right',
        }}
        render={({ pageNumber, totalPages }) =>
          `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`
        }
      />
    </>
  );
}

function Paragrafos({ texto }: { texto: string }) {
  return (
    <>
      {texto
        .split(/\n\s*\n/)
        .filter((t) => t.trim())
        .map((t, i) => (
          <Text key={i} style={s.paragraph} orphans={2} widows={2}>
            {t}
          </Text>
        ))}
    </>
  );
}
function Lista({ itens }: { itens: string[] }) {
  const validos = itens.filter((t) => t.trim());
  const quantidadeFinal = Math.min(3, validos.length);
  const agruparFinal = validos.slice(-quantidadeFinal).join(' ').length < 600;
  const inicioFinal = agruparFinal
    ? validos.length - quantidadeFinal
    : validos.length;
  const item = (t: string, i: number) => (
    <View key={i} style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText} orphans={2} widows={2}>
        {t}
      </Text>
    </View>
  );
  return (
    <>
      {validos.slice(0, inicioFinal).map(item)}
      {agruparFinal && (
        <View wrap={false}>{validos.slice(inicioFinal).map(item)}</View>
      )}
    </>
  );
}

function CurvasCapa() {
  return (
    <Svg
      width={595.28}
      height={841.89}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <Path
          key={i}
          d={`M ${323 + i * 19} 32 C ${520 + i * 10} 157 ${312 + i * 14} 312 629 ${387 + i * 18}`}
          fill="none"
          stroke="#284454"
          strokeWidth={0.7}
        />
      ))}
    </Svg>
  );
}
export function PropostaGerenciamentoPdf({
  edicao: e,
  recursos = recursosPropostaPadrao(),
}: {
  edicao: EdicaoContrato;
  recursos?: RecursosProposta;
}) {
  registrarFontesProposta(recursos);
  const p = e.proposta,
    total = calcularProposta(p),
    grupos = p.servicos.filter((g) => g.incluido);
  const titulo =
    e.titulo === 'Proposta de gerenciamento de aeronave'
      ? 'Gerenciamento\nde aeronaves'
      : e.titulo;
  const tamanhoTitulo = titulo.length > 110 ? 25 : titulo.length > 65 ? 30 : 38;
  const paragrafos = p.apresentacao.split(/\n\s*\n/).filter((t) => t.trim());
  const encerramentoCurto =
    [
      p.encerramento,
      e.contratada.nome,
      e.contratada.documento,
      e.contratada.endereco,
      e.contratada.email,
      e.contratada.telefone,
      e.contratada.representante_nome,
      e.contratada.representante_cargo,
    ]
      .filter(Boolean)
      .join(' ').length < 800;
  const abertura = paragrafos[0]?.length < 130 ? paragrafos.shift() : null;
  return (
    <Document
      title={e.titulo}
      author={e.contratada.nome || 'Share Brasil'}
      subject={`Proposta de gerenciamento - ${p.aeronave_descricao}`}
      language="pt-BR"
    >
      <Page size="A4" style={s.cover}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 595.28,
            height: 841.89,
          }}
        >
          <CurvasCapa />
        </View>

        <Image src={recursos.logoCapa} style={s.coverLogo} />
        <Text style={s.coverNumber}>{e.numero}</Text>
        <View style={s.coverLine} />
        <View style={s.coverContent}>
          <Text style={s.coverEyebrow}>PROPOSTA COMERCIAL</Text>
          <Text style={[s.coverTitle, { fontSize: tamanhoTitulo }]}>
            {titulo}
          </Text>
          <Text
            style={[
              s.coverAircraft,
              ...(p.aeronave_descricao.length > 100
                ? [{ fontSize: 12, letterSpacing: 0.5 }]
                : []),
            ]}
          >
            {p.aeronave_descricao || 'Aeronave a definir'}
          </Text>
          <Text style={s.coverScope}>
            {grupos.map((g) => g.titulo).join(' / ')}
          </Text>
        </View>
        <View style={s.coverClient}>
          <Text style={s.coverClientLabel}>PREPARADA PARA</Text>
          <Text style={s.coverClientValue}>
            {e.contratante.nome || 'Cliente a definir'}
          </Text>
        </View>
        <Text style={s.coverDate}>
          {p.cidade}
          {p.cidade ? ', ' : ''}
          {dataBR(p.emissao)}.
        </Text>
        <Rodape edicao={e} capa />
      </Page>
      <Page size="A4" style={s.page}>
        <Cabecalho section="Apresentação" recursos={recursos} />
        <Rodape edicao={e} />
        <Text style={s.eyebrow}>01 / NOSSA VISÃO</Text>
        <Text style={s.title}>Inovação que conecta.</Text>
        <View style={s.identification} wrap={false}>
          <View style={s.row}>
            <View style={s.column}>
              <Text style={s.label}>CONTRATANTE</Text>
              <Text style={s.value}>
                {e.contratante.nome || 'Cliente a definir'}
              </Text>
              {e.contratante.documento && (
                <Text style={s.small}>{e.contratante.documento}</Text>
              )}
            </View>
            <View style={s.column}>
              <Text style={s.label}>AERONAVE</Text>
              <Text style={s.value}>
                {p.aeronave_descricao || 'Aeronave a definir'}
              </Text>
            </View>
          </View>
          {e.titulo !== 'Proposta de gerenciamento de aeronave' && (
            <Text style={s.small}>{e.titulo}</Text>
          )}
          <Text style={s.small}>
            Emissão: {dataBR(p.emissao)} • Válida até{' '}
            {dataBR(validadeProposta(p))}
          </Text>
        </View>
        {abertura && <Text style={s.opening}>{abertura}</Text>}
        <Paragrafos texto={paragrafos.join('\n\n')} />
      </Page>
      <Page size="A4" style={s.page}>
        <Cabecalho section="Escopo e serviços" recursos={recursos} />
        <Rodape edicao={e} />
        <Text style={s.eyebrow}>02 / ESCOPO DO GERENCIAMENTO</Text>
        <Text style={s.title}>Precisão em cada detalhe.</Text>
        {grupos.map((g, i) => (
          <React.Fragment key={g.id}>
            <View style={s.serviceHeader} minPresenceAhead={55}>
              <Text style={s.serviceIndex}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text style={s.serviceTitle}>{g.titulo}</Text>
              {p.modo_cobranca === 'SERVICOS' ? (
                <Text style={s.serviceAmount}>
                  {moeda(g.valor_centavos)} / mês
                </Text>
              ) : (
                <Text style={s.serviceIncluded}>Incluído no pacote</Text>
              )}
            </View>
            <Lista itens={g.itens} />
            <View style={{ height: 14 }} />
          </React.Fragment>
        ))}
      </Page>
      <Page size="A4" style={s.page}>
        <Cabecalho section="Atendimento e condições" recursos={recursos} />
        <Rodape edicao={e} />
        <Text style={s.eyebrow}>03 / GESTÃO INTEGRADA</Text>
        <Text style={s.title}>Mais tempo para voar.</Text>
        {p.descricao_servicos.trim() && (
          <>
            <Text style={s.sectionLabel}>DESCRIÇÃO DOS SERVIÇOS</Text>
            <Paragrafos texto={p.descricao_servicos} />
          </>
        )}
        {p.areas.some((t) => t.trim()) && (
          <>
            <Text style={s.sectionLabel}>ÁREAS DE ATUAÇÃO</Text>
            <Lista itens={p.areas} />
          </>
        )}
        <View style={s.conditions}>
          <Text style={s.sectionLabel}>CONDIÇÕES DA PROPOSTA</Text>
          <View wrap={false}>
            <Text style={s.price}>{moeda(total.unitario)}</Text>
            <Text style={s.priceUnit}>
              Por mês •{' '}
              {p.unidade === 'POR_COTISTA' ? 'Por cotista' : 'Por aeronave'}
              {p.unidade === 'POR_COTISTA'
                ? ` • ${total.quantidade} cotista(s)`
                : ''}
            </Text>
            {total.quantidade > 1 && (
              <Text style={s.total}>Total mensal: {moeda(total.total)}</Text>
            )}
          </View>
          {e.forma_pagamento && (
            <Text style={s.paragraph}>
              Forma de pagamento: {e.forma_pagamento}
            </Text>
          )}
          <Paragrafos texto={p.condicoes} />
          <Text style={s.small}>
            Validade: {p.validade_dias} dias a partir da emissão (
            {dataBR(validadeProposta(p))}).
          </Text>
          {e.data_inicio && (
            <Text style={s.small}>
              Início previsto: {dataBR(e.data_inicio)}
              {e.data_fim ? ` • Término previsto: ${dataBR(e.data_fim)}` : ''}
            </Text>
          )}
          {!e.data_inicio && e.data_fim && (
            <Text style={s.small}>Término previsto: {dataBR(e.data_fim)}</Text>
          )}
          {e.foro && <Text style={s.small}>Foro: {e.foro}</Text>}
        </View>
        <View wrap={!encerramentoCurto}>
          <Text style={s.small}>
            {p.cidade}
            {p.cidade ? ', ' : ''}
            {dataBR(p.emissao)}.
          </Text>
          {p.encerramento.trim() && (
            <Text style={s.closing}>{p.encerramento}</Text>
          )}
          <View style={s.issuer} wrap={false}>
            <Text style={s.value}>{e.contratada.nome}</Text>
            <View style={s.row}>
              <View style={s.column}>
                {[e.contratada.documento, e.contratada.endereco]
                  .filter(Boolean)
                  .map((t, i) => (
                    <Text key={i} style={s.small}>
                      {t}
                    </Text>
                  ))}
              </View>
              <View style={s.column}>
                {[e.contratada.email, e.contratada.telefone]
                  .filter(Boolean)
                  .map((t, i) => (
                    <Text key={i} style={s.small}>
                      {t}
                    </Text>
                  ))}
              </View>
            </View>
            {e.contratada.representante_nome && (
              <Text style={s.small}>
                Representante: {e.contratada.representante_nome}
                {e.contratada.representante_cargo
                  ? ` • ${e.contratada.representante_cargo}`
                  : ''}
              </Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
export async function gerarPropostaPdf(edicao: EdicaoContrato) {
  return pdf(<PropostaGerenciamentoPdf edicao={edicao} />).toBlob();
}
