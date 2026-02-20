import register from './register';
import bootstrap from './bootstrap';
import routes from './routes';
import manualPublishController from './controllers/manual-publish';

const plugin: Record<string, unknown> = {
  register,
  bootstrap,
  routes,
  controllers: {
    backdate: manualPublishController,
  },
};

export default plugin;
