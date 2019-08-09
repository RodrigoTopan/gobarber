// Criação do servidor
// Separar app e server facilita os testes
import 'dotenv/config'
import app from './app';

app.listen(process.env.APP_PORT);