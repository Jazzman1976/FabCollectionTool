namespace FabCollectionTool.Classes
{
    public class ImportResult
    {
        public List<DataDto> DataDtos { get; set; } = new List<DataDto>();

        public int GetHaveSet(DataDto contextDto)
        {
            // count all foiling variants of same ID in same set
            int haveSet = this.DataDtos
                // can have different art treatments (marvels, extended art, etc.)
                // all those variants have the same id
                .Where(dto => dto.Id == contextDto.Id)
                .Sum(dto => dto.ST + dto.RF + dto.CF + dto.GF);
            return haveSet;
        }

        public int GetNeedSet(DataDto contextDto)
        {
            int needSet = Math.Max(0, contextDto.Playset - GetHaveSet(contextDto));
            return needSet;
        }

        public int GetLeftSet(DataDto contextDto)
        {
            int leftSet = Math.Max(0, GetHaveSet(contextDto) - contextDto.Playset);
            return leftSet;
        }

        /// <summary>
        /// Get amount of cards in all sets and of all art treatments
        /// </summary>
        /// <param name="contextDto">Card to look for</param>
        /// <returns>cound of cards</returns>
        public int GetHaveTotal(DataDto contextDto)
        {
            int haveTotal = this.DataDtos
                // can have different art treatments and can be of any other set
                // those cards have all the same name, pitch and preculiarity
                .Where(dto
                    => dto.Name == contextDto.Name
                    && dto.Pitch == contextDto.Pitch
                    && dto.Peculiarity == contextDto.Peculiarity)
                .Sum(dto => dto.ST + dto.RF + dto.CF + dto.GF);
            return haveTotal;
        }

        public int GetNeedTotal(DataDto contextDto)
        {
            int needTotal = Math.Max(0, contextDto.Playset - GetHaveTotal(contextDto));
            return needTotal;
        }

        public int GetLeftTotal(DataDto contextDto)
        {
            int leftTotal = Math.Max(0, GetHaveTotal(contextDto) - contextDto.Playset);
            return leftTotal;
        }
    }
}
