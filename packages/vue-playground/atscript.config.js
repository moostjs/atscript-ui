import ts from "@atscript/typescript";
import dbPlugin from "@atscript/db/plugin";
import uiFnsPlugin from "@atscript/ui-fns/plugin";

export default {
  plugins: [ts(), dbPlugin(), uiFnsPlugin()],
};
