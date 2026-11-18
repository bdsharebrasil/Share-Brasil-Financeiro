import PesoBalanceamentoFicha from './PesoBalanceamentoFicha';
import PreparacaoVoo, { type TransportePreparacao } from '@/components/preparacao/PreparacaoVoo';
import { colaboradorRequest, carregarArquivoColaborador, type SolicitacaoVooInterna } from '@/lib/colaborador-api';
import { supabase } from '@/lib/supabase';
const transporte: TransportePreparacao = {
  json: (path,body)=>colaboradorRequest(path,body===undefined?undefined:{method:'POST',body:JSON.stringify(body)}),
  arquivo:carregarArquivoColaborador,
  enviar:(path,body)=>colaboradorRequest(path,{method:'POST',body}),
  identidade:async()=>{const {data}=await supabase.auth.getSession();return data.session?.user?.id||null;},
};
export default function ChecklistPreVoo({item,aoConcluir,aoAtualizarProgresso}:{item:SolicitacaoVooInterna;aoConcluir?:()=>void|Promise<void>;aoAtualizarProgresso?:(n:number)=>void}){
  return <PreparacaoVoo vooId={item.id} api={transporte} painelAeronave={<PesoBalanceamentoFicha item={item}/>} aoSalvar={aoConcluir} aoProgresso={aoAtualizarProgresso}/>;
}
