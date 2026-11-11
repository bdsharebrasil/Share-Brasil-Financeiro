import test from 'node:test';
import assert from 'node:assert/strict';
import { cotistasDoEnvio, anexosSelecionadosDoCotista } from '../src/components/envio-pagamento/email-cotista.ts';
const cotistas=[{id:'a',nome:'Selecionado'},{id:'b',nome:'Outro cotista'}];
test('um cotista selecionado recebe o anexo compartilhado sem incluir o outro',()=>{
 const destinatarios=cotistasDoEnvio(cotistas,['a']);
 assert.deepEqual(destinatarios.map(c=>c.id),['a']);
 assert.equal(anexosSelecionadosDoCotista([{id:'compartilhado'}],destinatarios[0].id,['compartilhado'],{}).length,1);
});
test('seleção de vários e seleção vazia não viram todos os cotistas por suposição',()=>{
 assert.deepEqual(cotistasDoEnvio(cotistas,['a','b']).map(c=>c.id),['a','b']);
 assert.deepEqual(cotistasDoEnvio(cotistas,[]),[]);
 assert.deepEqual(cotistasDoEnvio(cotistas,['inexistente']),[]);
});
