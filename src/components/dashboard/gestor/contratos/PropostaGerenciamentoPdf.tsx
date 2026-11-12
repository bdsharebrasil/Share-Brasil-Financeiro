import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
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

const s = StyleSheet.create({
  page: {
    paddingTop: 76,
    paddingBottom: 55,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#253246',
    lineHeight: 1.5,
  },
  header: {
    position: 'absolute',
    top: 25,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#dce5ed',
    paddingBottom: 11,
  },
  brand: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#14334b',
    letterSpacing: 1.5,
  },
  brandSub: { fontSize: 7, color: '#587183', letterSpacing: 1.2 },
  reference: { fontSize: 8, color: '#647587', textAlign: 'right' },
  eyebrow: {
    fontSize: 8,
    color: '#15799c',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 27,
    fontFamily: 'Helvetica-Bold',
    color: '#14334b',
    lineHeight: 1.15,
    marginBottom: 17,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#14334b',
    marginBottom: 10,
  },
  paragraph: { marginBottom: 10, textAlign: 'justify' },
  parties: {
    padding: 14,
    backgroundColor: '#f2f6f9',
    borderRadius: 5,
    marginBottom: 18,
  },
  label: {
    fontSize: 7.5,
    color: '#60788b',
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  value: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#14334b' },
  muted: { fontSize: 8.5, color: '#607080' },
  two: { flexDirection: 'row', gap: 18 },
  half: { flex: 1 },
  price: {
    padding: 18,
    backgroundColor: '#14334b',
    borderRadius: 6,
    marginTop: 10,
    marginBottom: 17,
  },
  priceLabel: { fontSize: 8, color: '#a8d8e8', letterSpacing: 1 },
  priceValue: {
    fontSize: 28,
    lineHeight: 1.25,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginTop: 5,
    marginBottom: 8,
  },
  priceDetail: { fontSize: 9, color: '#d7e5ef', marginTop: 5 },
  section: { marginBottom: 15 },
  serviceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cbdce5',
    paddingBottom: 7,
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#14334b',
    flex: 1,
  },
  badge: { fontSize: 8, color: '#15799c', marginLeft: 12 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  dot: { width: 12, color: '#15799c' },
  bulletText: { flex: 1, fontSize: 9.2 },
  conditions: {
    borderLeftWidth: 3,
    borderLeftColor: '#228aab',
    paddingLeft: 13,
    marginTop: 10,
    marginBottom: 18,
  },
  closing: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#14334b',
    marginTop: 18,
  },
  footer: {
    position: 'absolute',
    top: 805,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#dce5ed',
    paddingTop: 8,
    fontSize: 7.5,
    color: '#728493',
  },
});
function Header({ numero }: { numero: string }) {
  return (
    <View style={s.header} fixed>
      <View>
        <Text style={s.brand}>SHARE BRASIL</Text>
        <Text style={s.brandSub}>GERENCIAMENTO DE AERONAVES</Text>
      </View>
      <Text style={s.reference}>{numero || 'Proposta comercial'}</Text>
    </View>
  );
}
function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>Share Brasil • Proposta comercial de gerenciamento</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <Text key={i} style={s.paragraph}>
            {p}
          </Text>
        ))}
    </>
  );
}
export function PropostaGerenciamentoPdf({
  edicao: e,
}: {
  edicao: EdicaoContrato;
}) {
  const p = e.proposta;
  const total = calcularProposta(p);
  return (
    <Document
      title={e.titulo}
      author={e.contratada.nome}
      subject="Proposta de gerenciamento de aeronave"
      language="pt-BR"
    >
      <Page size="A4" style={s.page}>
        <Header numero={e.numero} />
        <Footer />
        <Text style={s.eyebrow}>PROPOSTA COMERCIAL</Text>
        <Text style={s.title}>{e.titulo}</Text>
        <View style={s.parties}>
          <View style={s.two}>
            <View style={s.half}>
              <Text style={s.label}>PREPARADA PARA</Text>
              <Text style={s.value}>{e.contratante.nome}</Text>
              {e.contratante.documento && (
                <Text style={s.muted}>{e.contratante.documento}</Text>
              )}
            </View>
            <View style={s.half}>
              <Text style={s.label}>AERONAVE</Text>
              <Text style={s.value}>{p.aeronave_descricao}</Text>
            </View>
          </View>
          <Text style={[s.muted, { marginTop: 10 }]}>
            Emissão: {dataBR(p.emissao)} • Válida até{' '}
            {dataBR(validadeProposta(p))}
          </Text>
        </View>
        <Text style={s.subtitle}>Gestão para voar com tranquilidade</Text>
        <Paragraphs text={p.apresentacao} />
      </Page>
      <Page size="A4" style={s.page}>
        <Header numero={e.numero} />
        <Footer />
        <Text style={s.eyebrow}>ESCOPO DO GERENCIAMENTO</Text>
        <Text style={s.title}>Serviços incluídos</Text>
        {p.servicos
          .filter((g) => g.incluido)
          .map((g) => (
            <View key={g.id} style={s.section}>
              <View style={s.serviceHead} minPresenceAhead={60}>
                <Text style={s.serviceTitle}>{g.titulo}</Text>
                <Text style={s.badge}>
                  {p.modo_cobranca === 'PACOTE'
                    ? 'Incluído no pacote'
                    : `${moeda(g.valor_centavos)} / mês`}
                </Text>
              </View>
              {g.itens
                .filter((t) => t.trim())
                .map((t, i) => (
                  <View key={i} style={s.bullet}>
                    <Text style={s.dot}>•</Text>
                    <Text style={s.bulletText}>{t}</Text>
                  </View>
                ))}
            </View>
          ))}
      </Page>
      <Page size="A4" style={s.page}>
        <Header numero={e.numero} />
        <Footer />
        <Text style={s.eyebrow}>CONDIÇÕES COMERCIAIS</Text>
        <Text style={s.title}>Investimento e atendimento</Text>
        <View style={s.price} wrap={false}>
          <Text style={s.priceLabel}>
            {p.modo_cobranca === 'PACOTE'
              ? 'PACOTE DE GERENCIAMENTO'
              : 'SERVIÇOS SELECIONADOS'}
          </Text>
          <Text style={s.priceValue}>{moeda(total.unitario)}</Text>
          <Text style={s.priceDetail}>
            Mensal •{' '}
            {p.unidade === 'POR_COTISTA' ? 'Por cotista' : 'Por aeronave'}
            {p.unidade === 'POR_COTISTA'
              ? ` • ${total.quantidade} cotista(s)`
              : ''}
          </Text>
          {total.quantidade > 1 && (
            <Text style={s.priceDetail}>
              Total mensal da proposta: {moeda(total.total)}
            </Text>
          )}
        </View>
        <Text style={s.subtitle}>Gestão completa da operação</Text>
        <Paragraphs text={p.descricao_servicos} />
        {p.areas.filter((t) => t.trim()).length > 0 && (
          <>
            <Text style={[s.subtitle, { marginTop: 8 }]}>Áreas de atuação</Text>
            {p.areas
              .filter((t) => t.trim())
              .map((t, i) => (
                <View key={i} style={s.bullet}>
                  <Text style={s.dot}>•</Text>
                  <Text style={s.bulletText}>{t}</Text>
                </View>
              ))}
          </>
        )}
        <View style={s.conditions}>
          <Text style={s.label}>PAGAMENTO E CONDIÇÕES</Text>
          {e.forma_pagamento && (
            <Text style={{ marginBottom: 5 }}>
              Forma de pagamento: {e.forma_pagamento}
            </Text>
          )}
          <Paragraphs text={p.condicoes} />
          <Text style={s.muted}>
            Validade: {p.validade_dias} dias a partir da emissão (
            {dataBR(validadeProposta(p))}).
          </Text>
          {e.data_inicio && (
            <Text style={s.muted}>
              Início previsto: {dataBR(e.data_inicio)}
              {e.data_fim ? ` • Término previsto: ${dataBR(e.data_fim)}` : ''}
            </Text>
          )}
        </View>
        {e.foro && <Text style={s.muted}>Foro: {e.foro}</Text>}
        <Text>
          {p.cidade}, {dataBR(p.emissao)}.
        </Text>
        <Text style={s.closing}>{p.encerramento}</Text>
        <View style={{ marginTop: 18 }}>
          <Text style={s.value}>{e.contratada.nome}</Text>
          {[e.contratada.documento, e.contratada.email, e.contratada.telefone]
            .filter(Boolean)
            .map((t, i) => (
              <Text key={i} style={s.muted}>
                {t}
              </Text>
            ))}
        </View>
      </Page>
    </Document>
  );
}
export async function gerarPropostaPdf(edicao: EdicaoContrato) {
  return pdf(<PropostaGerenciamentoPdf edicao={edicao} />).toBlob();
}
