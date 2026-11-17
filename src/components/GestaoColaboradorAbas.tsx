import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  FolderOpen,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { FichaColaborador } from "@/lib/colaborador-api";
import { DocumentosColaborador } from "@/components/colaboradores/DocumentosColaborador";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  brl,
  dataBr,
  formatarFuncao,
  hojeLocal,
  inativo,
  nomeColaborador,
} from "@/lib/gestao-colaboradores";
import {
  AvatarColaborador,
  DadoFicha,
  StatusColaborador,
  VazioColaboradores,
} from "@/components/colaboradores/ComponentesColaboradores";
import "@/components/colaboradores/colaboradores.css";

export function FichaColaboradorAbas({
  ficha,
  onClose,
  onEdit,
}: {
  ficha: FichaColaborador;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { perfil } = ficha;
  const hoje = hojeLocal();
  const feriasAtuais =
    ficha.ferias.some(
      (f) =>
        f.status.toLowerCase() === "aprovada" &&
        f.data_inicio <= hoje &&
        f.data_fim >= hoje,
    ) || perfil.status?.toLowerCase() === "ferias";
  return (
    <div>
      <button type="button" className="rh-profile-back" onClick={onClose}>
        <ArrowLeft size={15} /> Todos os colaboradores
      </button>
      <Tabs defaultValue="pessoal">
        <section className="rh-panel rh-profile-header">
          <div className="rh-profile-identity">
            <div className="rh-profile-name">
              <AvatarColaborador
                nome={nomeColaborador(perfil)}
                url={perfil.url_avatar}
                colaboradorId={perfil.id}
                grande
              />
              <div className="rh-profile-details">
                <div className="rh-profile-badges">
                  <StatusColaborador
                    tom={
                      inativo(perfil.status)
                        ? "neutro"
                        : feriasAtuais
                          ? "ambar"
                          : "verde"
                    }
                  >
                    {inativo(perfil.status)
                      ? "Inativo"
                      : feriasAtuais
                        ? "Em férias"
                        : "Ativo"}
                  </StatusColaborador>
                  {ficha.funcoes.map((funcao) => (
                    <StatusColaborador key={funcao.id} tom="azul">
                      {formatarFuncao(funcao.funcao)}
                    </StatusColaborador>
                  ))}
                </div>
                <h1 id="rh-perfil-titulo" tabIndex={-1}>
                  {nomeColaborador(perfil)}
                </h1>
                <div className="rh-profile-contact">
                  <a href={`mailto:${perfil.email}`}>
                    <Mail size={13} />
                    {perfil.email}
                  </a>
                  {perfil.telefone && (
                    <a href={`tel:${perfil.telefone.replace(/[^+\d]/g, "")}`}>
                      <Phone size={13} />
                      {perfil.telefone}
                    </a>
                  )}
                </div>
                <dl className="rh-profile-meta">
                  <DadoFicha
                    titulo="Departamento"
                    valor={perfil.departamento}
                  />
                  <DadoFicha
                    titulo="Admissão"
                    valor={dataBr(perfil.data_admissao)}
                  />
                </dl>
              </div>
            </div>
            <button type="button" className="rh-btn" onClick={onEdit}>
              <Pencil size={15} /> Editar cadastro
            </button>
          </div>
          <TabsList
            className="rh-profile-tabs"
            aria-label="Informações do colaborador"
          >
            <TabsTrigger value="pessoal" className="rh-profile-tab">
              <UserRound size={15} /> Dados pessoais
            </TabsTrigger>
            <TabsTrigger value="profissional" className="rh-profile-tab">
              <BriefcaseBusiness size={15} /> Profissional
            </TabsTrigger>
            <TabsTrigger value="documentos" className="rh-profile-tab">
              <FolderOpen size={15} /> Documentos
            </TabsTrigger>
            <TabsTrigger value="ferias" className="rh-profile-tab">
              <CalendarDays size={15} /> Férias
            </TabsTrigger>
            <TabsTrigger value="extrato" className="rh-profile-tab">
              <WalletCards size={15} /> Extrato recebido
            </TabsTrigger>
          </TabsList>
        </section>
        <TabsContent value="pessoal" className="rh-profile-content rh-enter">
          <div className="rh-profile-layout">
            <div>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Informações pessoais</h2>
                  <UserRound size={16} className="rh-text-muted" />
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha
                    titulo="Nome completo"
                    valor={perfil.nome_completo}
                  />
                  <DadoFicha
                    titulo="Nome de exibição"
                    valor={perfil.nome_exibicao}
                  />
                  <DadoFicha
                    titulo="Data de nascimento"
                    valor={dataBr(perfil.data_nascimento)}
                  />
                  <DadoFicha titulo="CPF" valor={perfil.cpf} />
                  <DadoFicha titulo="RG" valor={perfil.rg} />
                  <DadoFicha titulo="CANAC" valor={perfil.canac} />
                </dl>
              </section>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Contato e localização</h2>
                  <MapPin size={16} className="rh-text-muted" />
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha titulo="E-mail" valor={perfil.email} />
                  <DadoFicha titulo="Telefone" valor={perfil.telefone} />
                  <DadoFicha
                    titulo="Cidade / UF"
                    valor={[perfil.cidade, perfil.uf]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                </dl>
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="profissional"
          className="rh-profile-content rh-enter"
        >
          <div className="rh-profile-layout">
            <div>
              <section className="rh-panel rh-profile-section">
                <header className="rh-panel-head">
                  <h2>Exame admissional</h2>
                  <StatusColaborador
                    tom={perfil.exame_admissional_realizado ? "verde" : "ambar"}
                  >
                    {perfil.exame_admissional_realizado
                      ? "Realizado"
                      : "Pendente"}
                  </StatusColaborador>
                </header>
                <dl className="rh-details-grid">
                  <DadoFicha
                    titulo="Data do exame"
                    valor={dataBr(perfil.exame_admissional_data)}
                  />
                  <DadoFicha
                    titulo="Local"
                    valor={perfil.exame_admissional_local}
                  />
                  <DadoFicha
                    titulo="Empresa responsável"
                    valor={perfil.exame_admissional_empresa}
                  />
                  <DadoFicha
                    titulo="Prazo para realizar"
                    valor={dataBr(perfil.exame_admissional_prazo)}
                  />
                  <DadoFicha
                    titulo="Comprovante"
                    valor={
                      perfil.exame_admissional_documento_id
                        ? "Anexado em documentos"
                        : "Não anexado"
                    }
                  />
                </dl>
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="documentos" className="rh-profile-content rh-enter">
          <DocumentosColaborador
            documentos={ficha.documentos}
            colaboradorId={perfil.id}
          />
        </TabsContent>
        <TabsContent value="ferias" className="rh-profile-content rh-enter">
          <section className="rh-panel">
            <header className="rh-panel-head">
              <div>
                <h2>Histórico de férias</h2>
                <p>{ficha.ferias.length} solicitação(ões)</p>
              </div>
              <CalendarDays size={17} className="rh-text-muted" />
            </header>
            {ficha.ferias.length ? (
              <div className="rh-table-wrap">
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Dias</th>
                      <th>Situação</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.ferias.map((f) => (
                      <tr key={f.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {dataBr(f.data_inicio)} a {dataBr(f.data_fim)}
                        </td>
                        <td>{f.quantidade_dias}</td>
                        <td>
                          <StatusColaborador
                            tom={
                              f.status === "aprovada"
                                ? "verde"
                                : f.status === "solicitada"
                                  ? "ambar"
                                  : f.status === "reprovada"
                                    ? "vermelho"
                                    : "neutro"
                            }
                          >
                            {{
                              aprovada: "Aprovada",
                              solicitada: "Solicitada",
                              reprovada: "Reprovada",
                              cancelada: "Cancelada",
                            }[f.status] || f.status}
                          </StatusColaborador>
                        </td>
                        <td>{f.motivo_reprovacao || f.observacoes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <VazioColaboradores
                titulo="Nenhuma solicitação de férias"
                detalhe="As solicitações deste colaborador aparecerão aqui."
              />
            )}
          </section>
        </TabsContent>
        <TabsContent value="extrato" className="rh-profile-content rh-enter">
          <section className="rh-panel">
            <header className="rh-panel-head">
              <div>
                <h2>Extrato do colaborador</h2>
                <p>Últimos {ficha.recebimentos.length} registros disponíveis</p>
              </div>
              <WalletCards size={17} className="rh-text-muted" />
            </header>
            {ficha.recebimentos.length ? (
              <div className="rh-table-wrap">
                <table className="rh-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Vencimento</th>
                      <th>Pagamento</th>
                      <th>Situação</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.recebimentos.map((r) => {
                      const status = String(r.status || "").toLowerCase();
                      const pago =
                        Boolean(r.data_pagamento) || status === "pago";
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong>
                              {r.descricao || r.tipo || "Recebimento"}
                            </strong>
                            {r.observacoes && (
                              <p className="rh-inline-meta">{r.observacoes}</p>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {dataBr(
                              String(
                                r.data_vencimento ||
                                  r.vencimento ||
                                  r.data ||
                                  "",
                              ),
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {dataBr(r.data_pagamento)}
                          </td>
                          <td>
                            <StatusColaborador
                              tom={
                                status === "cancelado"
                                  ? "neutro"
                                  : pago
                                    ? "verde"
                                    : "ambar"
                              }
                            >
                              {status === "cancelado"
                                ? "Cancelado"
                                : pago
                                  ? "Pago"
                                  : status === "pendente"
                                    ? "Pendente"
                                    : String(r.status || "Registrado").replace(
                                        /_/g,
                                        " ",
                                      )}
                            </StatusColaborador>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                            }}
                          >
                            {brl(r.valor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <VazioColaboradores
                titulo="Nenhum recebimento disponível"
                detalhe="Os registros financeiros vinculados ao colaborador aparecerão aqui."
              />
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
