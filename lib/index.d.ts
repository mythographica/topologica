declare type TopDef = {
    name: string;
    path: string;
    type: CallableFunction;
    kids: TopDef[];
};
declare type LoaderOutput = {
    topology?: Record<string, TopDef>;
    logs?: string[][];
};
declare const loader: (topologyPath: string, define: CallableFunction, checker?: CallableFunction) => LoaderOutput;
export default loader;
