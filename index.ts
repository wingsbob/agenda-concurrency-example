import * as Agenda from 'agenda';
import { connect } from 'mongodb';

(async () => {
  const concurrency = parseInt(process.env.CONCURRENCY || '5', 10);
  const client = await connect('mongodb://localhost:27017', { useNewUrlParser: true });
  const db = client.db('agenda-concurrency-test');
  const agenda = new Agenda();

  await db.collection('agendaJobs').deleteMany({}); // Ensure we have no jobs in our DB to start with

  let currentJobs = 0;
  agenda.defaultConcurrency(concurrency);
  console.log(`default job concurrency: ${concurrency}`)
  console.log(`default agenda instance concurrency: ${(agenda as any)._maxConcurrency}`)
  agenda.define('test-job', async ({ attrs: { _id } }, done) => {
    currentJobs++;
    console.log(`job ${_id} started: total running: ${currentJobs}`);
    await new Promise(res => setTimeout(res, 10 * 1000));
    currentJobs--;
    console.log(`job ${_id} finished: total running: ${currentJobs}`);
    done();
  });
  agenda.mongo(db, 'agendaJobs');
  await Promise.all(
    new Array(concurrency * 5).fill('test-job')
      .map(name => agenda.create(name).repeatEvery('1 second').save())
  );

  console.log(`${await db.collection('agendaJobs').countDocuments()} jobs created`);
  await agenda.start();

  await new Promise(res => setTimeout(res, 30 * 1000));

  console.log('shutting down');
  await agenda.stop();
  await new Promise(res => setTimeout(res, 15 * 1000)); // Agenda#stop doesn't wait for jobs to finish processing....
  await client.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
